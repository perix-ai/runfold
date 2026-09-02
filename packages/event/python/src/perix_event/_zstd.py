"""Small compatibility layer for independent DSH-style Zstandard frames."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


try:  # Python 3.14+
    from compression import zstd as _stdlib_zstd
except ImportError:  # pragma: no cover - exercised on supported older Pythons
    _stdlib_zstd = None

try:  # Optional dependency for Python 3.10-3.13.
    import zstandard as _third_party_zstd
except ImportError:  # pragma: no cover - depends on the consumer environment
    _third_party_zstd = None


class ZstdUnavailableError(RuntimeError):
    pass


@dataclass(frozen=True)
class DecodedFrame:
    start: int
    end: int
    plaintext: bytes


@dataclass(frozen=True)
class FrameScan:
    frames: tuple[DecodedFrame, ...]
    torn_start: int | None


def available() -> bool:
    return _stdlib_zstd is not None or _third_party_zstd is not None


def backend_name() -> str | None:
    if _stdlib_zstd is not None:
        return "compression.zstd"
    if _third_party_zstd is not None:
        return "zstandard"
    return None


def _require() -> None:
    if not available():
        raise ZstdUnavailableError(
            "Zstandard support requires Python 3.14+ or the 'perix-event-sdk[zstd]' extra"
        )


def compress_frame(plaintext: bytes) -> bytes:
    _require()
    if _stdlib_zstd is not None:
        return _stdlib_zstd.compress(
            plaintext,
            options={_stdlib_zstd.CompressionParameter.checksum_flag: 1},
        )
    compressor = _third_party_zstd.ZstdCompressor(write_checksum=True)
    return compressor.compress(plaintext)


def _decompress_one(data: bytes) -> tuple[bytes, bool, int]:
    """Return plaintext, frame-complete flag, and consumed compressed bytes."""

    _require()
    if _stdlib_zstd is not None:
        decoder = _stdlib_zstd.ZstdDecompressor()
        plaintext = decoder.decompress(data)
        consumed = len(data) - len(decoder.unused_data)
        return plaintext, bool(decoder.eof), consumed
    decoder = _third_party_zstd.ZstdDecompressor().decompressobj()
    plaintext = decoder.decompress(data)
    consumed = len(data) - len(decoder.unused_data)
    return plaintext, bool(decoder.eof), consumed


def scan_frames(buffer: bytes) -> FrameScan:
    """Decode complete concatenated frames and identify an incomplete final frame."""

    _require()
    frames: list[DecodedFrame] = []
    offset = 0
    while offset < len(buffer):
        try:
            plaintext, complete, consumed = _decompress_one(buffer[offset:])
        except Exception as error:
            raise ValueError(f"corrupt Zstandard frame at byte {offset}") from error
        if not complete:
            return FrameScan(tuple(frames), offset)
        if consumed <= 0:
            raise ValueError(f"corrupt zero-length Zstandard frame at byte {offset}")
        frames.append(DecodedFrame(offset, offset + consumed, plaintext))
        offset += consumed
    return FrameScan(tuple(frames), None)


def decompress_prefix(buffer: bytes) -> bytes:
    """Return any plaintext emitted by an incomplete final frame."""

    try:
        plaintext, _, _ = _decompress_one(buffer)
        if plaintext:
            return plaintext
    except Exception:
        pass

    # A checksummed frame whose compressed payload is complete but whose final
    # four-byte checksum was torn can be decoded safely by clearing only the
    # checksum-present bit in a temporary header. The original bytes remain
    # untouched and the caller still truncates the torn physical frame before
    # re-encoding recovered complete JSONL records into a fresh checked frame.
    if (
        len(buffer) >= 5
        and buffer[:4] == b"\x28\xb5\x2f\xfd"
        and buffer[4] & 0x04
    ):
        unchecked = bytearray(buffer)
        unchecked[4] &= ~0x04
        try:
            plaintext, _, _ = _decompress_one(bytes(unchecked))
            return plaintext
        except Exception:
            pass
    return b""
