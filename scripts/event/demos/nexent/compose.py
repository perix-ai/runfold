from __future__ import annotations

import argparse
import hashlib
import math
import os
import shutil
import struct
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


WIDTH = 1440
HEIGHT = 900
FPS = 24
PRELUDE = 0.5
GAP = 0.35

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]
PUBLISHED_DIR = REPO_ROOT / "docs/event/demos/nexent"
CAPTURES = SCRIPT_DIR / "captures"
AUDIO_DIR = SCRIPT_DIR / "narration"
DEFAULT_WORK_DIR = REPO_ROOT / "build/event-demo/nexent"
WORK_DIR = DEFAULT_WORK_DIR
VIDEO_PATH = WORK_DIR / "trajectory-restore-fork-demo.mp4"
COVER_PATH = WORK_DIR / "cover.jpg"
AUDIO_PATH = WORK_DIR / "narration.wav"
BASE_AUDIO_PATH = WORK_DIR / "narration-base.wav"
CLICK_AUDIO_PATH = WORK_DIR / "clicks.wav"
FFMPEG = "ffmpeg"


def resolve_font_path(environment_name: str, candidates: list[str]) -> str:
    configured = os.environ.get(environment_name)
    if configured:
        path = Path(configured).expanduser()
        if path.is_file():
            return str(path.resolve())
        raise SystemExit(f"{environment_name} does not point to a font file: {path}")
    for candidate in candidates:
        path = Path(candidate)
        if path.is_file():
            return str(path.resolve())
    raise SystemExit(
        f"No CJK font found; set {environment_name} to an installed TTF/TTC/OTF file"
    )


FONT_LIGHT = resolve_font_path(
    "PERIX_DEMO_FONT_REGULAR",
    [
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "C:/Windows/Fonts/msyh.ttc",
    ],
)
FONT_MEDIUM = resolve_font_path(
    "PERIX_DEMO_FONT_MEDIUM",
    [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc",
        FONT_LIGHT,
    ],
)

NAVY = (14, 27, 42)
NAVY_2 = (23, 42, 62)
BLUE = (68, 127, 247)
ORANGE = (242, 153, 74)
GREEN = (50, 190, 140)
WHITE = (255, 255, 255)
MUTED = (196, 208, 224)


def font(size: int, medium: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_MEDIUM if medium else FONT_LIGHT, size)


FONTS = {
    "kicker": font(24, True),
    "title": font(58, True),
    "subtitle": font(30),
    "caption": font(29, True),
    "caption_small": font(22),
    "label": font(20, True),
    "metric": font(39, True),
    "metric_label": font(18),
    "footer": font(20),
}


@dataclass(frozen=True)
class Chapter:
    key: str
    label: str
    audio: str
    start: float
    end: float


def fit_image(filename: str) -> Image.Image:
    image = Image.open(CAPTURES / filename).convert("RGB")
    if image.size != (WIDTH, HEIGHT):
        image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return image


IMAGES = {
    name: fit_image(name)
    for name in [
        "trajectory-default.png",
        "trajectory-subtool-details.png",
        "restore-before-10.png",
        "restore-after-21.png",
        "chat-fork-tooltip.png",
        "chat-fork-after.png",
        "trajectory-select-open.png",
        "trajectory-turn20-selected.png",
        "trajectory-fork-after-loaded.png",
    ]
}


def multiline_center(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    chosen_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    spacing: int = 12,
) -> None:
    bounds = draw.multiline_textbbox(
        (0, 0), text, font=chosen_font, spacing=spacing, align="center"
    )
    text_width = bounds[2] - bounds[0]
    draw.multiline_text(
        ((WIDTH - text_width) / 2, y),
        text,
        font=chosen_font,
        fill=fill,
        spacing=spacing,
        align="center",
    )


def title_card() -> Image.Image:
    source = IMAGES["trajectory-default.png"].filter(ImageFilter.GaussianBlur(5))
    source = ImageEnhance.Brightness(source).enhance(0.20).convert("RGBA")
    source = Image.alpha_composite(
        source, Image.new("RGBA", source.size, NAVY + (140,))
    )
    draw = ImageDraw.Draw(source)
    draw.rounded_rectangle((474, 133, 966, 183), radius=25, fill=BLUE + (240,))
    label = "NEXENT · EVENT TRAJECTORY"
    label_width = draw.textbbox((0, 0), label, font=FONTS["kicker"])[2]
    draw.text(((WIDTH - label_width) / 2, 143), label, font=FONTS["kicker"], fill=WHITE)
    multiline_center(draw, "轨迹恢复与 Fork", 237, FONTS["title"], WHITE)
    multiline_center(
        draw,
        "聊天区：快速按当前回答分叉\n轨迹区：精确选择 Turn / Event 后分叉",
        352,
        FONTS["subtitle"],
        MUTED,
        spacing=18,
    )
    draw.rounded_rectangle((296, 512, 1144, 607), radius=18, fill=NAVY_2 + (238,))
    draw.ellipse((332, 544, 348, 560), fill=GREEN)
    draw.text((370, 531), "Resume 由宿主自动完成，不虚构额外按钮", font=FONTS["subtitle"], fill=WHITE)
    draw.text((44, 850), "PERIX EVENT · NEXENT UI ACCEPTANCE", font=FONTS["footer"], fill=MUTED)
    draw.text((1205, 850), "R41", font=FONTS["footer"], fill=MUTED)
    return source.convert("RGB")


def evidence_card() -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), NAVY)
    draw = ImageDraw.Draw(canvas)
    draw.text((92, 78), "验证结论", font=FONTS["title"], fill=WHITE)
    draw.text((96, 159), "两个入口，共用同一套稳定 Event 边界", font=FONTS["subtitle"], fill=MUTED)

    metrics = [
        ("10 → 21", "同一 Session 恢复"),
        ("Event 188", "第 20 轮边界"),
        ("189", "子轨迹继承 Event"),
        ("2", "真实 Fork 入口"),
    ]
    x = 92
    for value, label in metrics:
        draw.rounded_rectangle(
            (x, 245, x + 285, 405),
            radius=18,
            fill=NAVY_2,
            outline=(54, 78, 104),
            width=2,
        )
        draw.text((x + 24, 278), value, font=FONTS["metric"], fill=ORANGE)
        draw.text((x + 24, 352), label, font=FONTS["metric_label"], fill=MUTED)
        x += 318

    rows = [
        ("聊天快速 Fork", "按已完成回答定位 Turn；真实点击后进入子会话"),
        ("轨迹精确 Fork", "选择第 20 轮 · Event 188；父子血缘可见"),
        ("DSH 一致性", "EventTrajectory 内部源码与交互未修改"),
        ("媒体升级", "Xiaoxiao Neural · 快速指向 · 按下态 · 双脉冲"),
    ]
    y = 475
    for title, detail in rows:
        draw.ellipse((96, y + 9, 112, y + 25), fill=GREEN)
        draw.text((132, y), title, font=FONTS["label"], fill=WHITE)
        draw.text((342, y), detail, font=FONTS["caption_small"], fill=MUTED)
        y += 65
    draw.text((92, 790), "功能仍为 Nexent 本地 commit f10c9b5；本次只重制 Demo", font=FONTS["subtitle"], fill=MUTED)
    return canvas


TITLE = title_card()
EVIDENCE = evidence_card()


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 0.5 - math.cos(value * math.pi) / 2


def blend(left: Image.Image, right: Image.Image, value: float) -> Image.Image:
    return Image.blend(left, right, ease(value))


def cursor_position(
    progress: float,
    start_progress: float,
    end_progress: float,
    start: tuple[int, int],
    end: tuple[int, int],
) -> tuple[int, int]:
    amount = ease((progress - start_progress) / (end_progress - start_progress))
    return (
        round(start[0] + (end[0] - start[0]) * amount),
        round(start[1] + (end[1] - start[1]) * amount),
    )


def draw_cursor(canvas: Image.Image, x: int, y: int, pressed: bool = False) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    if pressed:
        x += 3
        y += 3
    points = [(x, y), (x + 2, y + 32), (x + 10, y + 24), (x + 18, y + 42), (x + 25, y + 39), (x + 17, y + 21), (x + 31, y + 20)]
    draw.polygon(points, fill=WHITE + (255,), outline=(15, 23, 33, 255))
    draw.line(points + [points[0]], fill=(15, 23, 33, 255), width=3, joint="curve")


def draw_click_feedback(
    canvas: Image.Image,
    x: int,
    y: int,
    phase: float,
    button_box: tuple[int, int, int, int] | None = None,
) -> None:
    phase = max(0.0, min(1.0, phase))
    draw = ImageDraw.Draw(canvas, "RGBA")
    strength = math.sin(math.pi * phase)
    if button_box is not None:
        draw.rounded_rectangle(
            button_box,
            radius=9,
            fill=ORANGE + (round(38 + 92 * strength),),
            outline=ORANGE + (255,),
            width=6,
        )

    first = min(1.0, phase / 0.68)
    first_radius = round(10 + 46 * first)
    draw.ellipse(
        (x - first_radius, y - first_radius, x + first_radius, y + first_radius),
        outline=ORANGE + (round(255 * (1 - first)),),
        width=7,
    )
    if phase >= 0.24:
        second = min(1.0, (phase - 0.24) / 0.76)
        second_radius = round(8 + 62 * second)
        draw.ellipse(
            (x - second_radius, y - second_radius, x + second_radius, y + second_radius),
            outline=BLUE + (round(235 * (1 - second)),),
            width=6,
        )
    flash_radius = round(13 - 5 * strength)
    draw.ellipse(
        (x - flash_radius, y - flash_radius, x + flash_radius, y + flash_radius),
        fill=WHITE + (round(165 + 90 * strength),),
        outline=ORANGE + (255,),
        width=4,
    )
    label = "点击"
    label_width = draw.textbbox((0, 0), label, font=FONTS["label"])[2]
    pill_x = min(WIDTH - label_width - 32, x + 35)
    pill_y = max(8, y - 43)
    draw.rounded_rectangle(
        (pill_x, pill_y, pill_x + label_width + 24, pill_y + 32),
        radius=15,
        fill=ORANGE + (250,),
    )
    draw.text((pill_x + 12, pill_y + 3), label, font=FONTS["label"], fill=NAVY)


def draw_zoom_inset(
    canvas: Image.Image,
    source: Image.Image,
    source_box: tuple[int, int, int, int],
    destination_box: tuple[int, int, int, int],
    label: str,
) -> None:
    x1, y1, x2, y2 = destination_box
    crop = source.crop(source_box).resize(
        (x2 - x1, y2 - y1), Image.Resampling.LANCZOS
    )
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (x1 - 8, y1 - 8, x2 + 12, y2 + 12),
        radius=18,
        fill=NAVY + (90,),
    )
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB"))
    canvas.paste(crop, (x1, y1))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle(destination_box, radius=12, outline=BLUE + (255,), width=5)
    label_width = draw.textbbox((0, 0), label, font=FONTS["label"])[2]
    draw.rounded_rectangle(
        (x1, y1 - 38, x1 + label_width + 24, y1 - 6),
        radius=15,
        fill=BLUE + (250,),
    )
    draw.text((x1 + 12, y1 - 35), label, font=FONTS["label"], fill=WHITE)


def draw_box(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    label: str,
    color: tuple[int, int, int] = ORANGE,
) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(
        box, radius=10, fill=color + (28,), outline=color + (245,), width=4
    )
    text_box = draw.textbbox((0, 0), label, font=FONTS["label"])
    label_width = text_box[2] - text_box[0]
    pill_x = min(max(8, x1), WIDTH - label_width - 32)
    pill_y = max(8, y1 - 38)
    draw.rounded_rectangle(
        (pill_x, pill_y, pill_x + label_width + 24, pill_y + 32),
        radius=15,
        fill=color + (245,),
    )
    draw.text((pill_x + 12, pill_y + 3), label, font=FONTS["label"], fill=NAVY)


def draw_caption(canvas: Image.Image, label: str, title: str, detail: str) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 770, WIDTH, HEIGHT), fill=NAVY + (239,))
    draw.rounded_rectangle((34, 794, 185, 836), radius=21, fill=BLUE + (245,))
    label_width = draw.textbbox((0, 0), label, font=FONTS["label"])[2]
    draw.text((109 - label_width / 2, 801), label, font=FONTS["label"], fill=WHITE)
    draw.text((211, 787), title, font=FONTS["caption"], fill=WHITE)
    draw.text((211, 834), detail, font=FONTS["caption_small"], fill=MUTED)
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB"))


def chapter_frame(chapter: str, progress: float) -> Image.Image:
    click_phase: float | None = None
    click_box: tuple[int, int, int, int] | None = None
    cursor: tuple[int, int] | None = None

    if chapter == "intro":
        canvas = TITLE.copy()
        return canvas

    if chapter == "trajectory":
        if progress < 0.66:
            canvas = IMAGES["trajectory-default.png"].copy()
            draw_box(canvas, (546, 115, 1432, 232), "Session · 完整时间线", BLUE)
            cursor = cursor_position(progress, 0.50, 0.55, (1080, 520), (680, 404))
            if 0.58 <= progress <= 0.64:
                click_phase = (progress - 0.58) / 0.06
                click_box = (610, 389, 816, 420)
            title = "DSH 原样轨迹：Session、时间线与事件层级"
            detail = "鼠标快速定位 add 子工具，短暂停留后点击。"
        elif progress < 0.74:
            canvas = blend(
                IMAGES["trajectory-default.png"],
                IMAGES["trajectory-subtool-details.png"],
                (progress - 0.66) / 0.08,
            )
            title = "点击 add 子工具 Event"
            detail = "右侧详情面板来自保留的 DeepSeek Harness UI。"
        else:
            canvas = IMAGES["trajectory-subtool-details.png"].copy()
            draw_box(canvas, (1097, 236, 1438, 758), "详情 · Schema", BLUE)
            cursor = cursor_position(progress, 0.76, 0.81, (785, 278), (1276, 294))
            title = "原有详情面板完整保留"
            detail = "概述、参数、结果、Schema 与计时均可检查。"
        draw_caption(canvas, "01 轨迹", title, detail)

    elif chapter == "restore":
        if progress < 0.69:
            canvas = IMAGES["restore-before-10.png"].copy()
            draw_box(canvas, (546, 115, 1268, 150), "进程 A · 10 Turn / 97 Event")
            draw_zoom_inset(
                canvas,
                IMAGES["restore-before-10.png"],
                (1070, 109, 1435, 157),
                (690, 215, 1410, 310),
                "刷新操作区 · 放大",
            )
            cursor = cursor_position(progress, 0.52, 0.57, (910, 470), (1176, 260))
            if 0.61 <= progress <= 0.68:
                click_phase = (progress - 0.61) / 0.07
                click_box = (1103, 225, 1250, 300)
            title = "中断前：进程 A 已持久化 10 个 Turn"
            detail = "Resume 发生在宿主打开同一 Session 时，不是前端按钮。"
        elif progress < 0.77:
            canvas = blend(
                IMAGES["restore-before-10.png"],
                IMAGES["restore-after-21.png"],
                (progress - 0.69) / 0.08,
            )
            title = "刷新只重新读取已恢复的后端 Event"
            detail = "新进程 B 已按相同 Session ID 完成冷恢复并续写。"
        else:
            canvas = IMAGES["restore-after-21.png"].copy()
            draw_box(canvas, (1124, 116, 1353, 149), "21 Turn · Event 196", GREEN)
            draw_box(canvas, (540, 630, 1426, 691), "restored-21", GREEN)
            title = "恢复后：同一 Session 延续到 21 个 Turn"
            detail = "轨迹底部新增 restored-21；旧 Event 保持不变。"
        draw_caption(canvas, "02 恢复", title, detail)

    elif chapter == "chat_fork":
        if progress < 0.46:
            canvas = IMAGES["chat-fork-tooltip.png"].copy()
            draw_box(canvas, (576, 307, 760, 457), "第 20 轮回答")
            draw_zoom_inset(
                canvas,
                IMAGES["chat-fork-tooltip.png"],
                (568, 305, 770, 465),
                (54, 145, 508, 505),
                "聊天消息操作区 · 放大",
            )
            draw_box(canvas, (160, 318, 250, 400), "Fork 图标")
            cursor = cursor_position(progress, 0.18, 0.23, (520, 590), (257, 359))
            if 0.31 <= progress <= 0.38:
                click_phase = (progress - 0.31) / 0.07
                click_box = (160, 318, 250, 400)
            title = "聊天快捷 Fork：定位回答，点击“从此轮分叉”"
            detail = "放大操作区清楚展示鼠标抵达、按下和双脉冲反馈。"
        elif progress < 0.54:
            canvas = blend(
                IMAGES["chat-fork-tooltip.png"],
                IMAGES["chat-fork-after.png"],
                (progress - 0.46) / 0.08,
            )
            title = "真实导航到子会话"
            detail = "后端只接受第 20 轮对应的 Event 188。"
        else:
            canvas = IMAGES["chat-fork-after.png"].copy()
            draw_box(canvas, (594, 63, 906, 101), "子会话")
            draw_box(canvas, (862, 443, 1386, 594), "fork-21 · 独立续写", GREEN)
            title = "子会话继承前缀后独立续写"
            detail = "聊天入口适合日常使用：快、直接、上下文明确。"
        draw_caption(canvas, "03 快捷", title, detail)

    elif chapter == "trajectory_fork":
        if progress < 0.35:
            canvas = IMAGES["trajectory-select-open.png"].copy()
            draw_box(canvas, (1115, 115, 1272, 151), "分叉点下拉框")
            draw_zoom_inset(
                canvas,
                IMAGES["trajectory-select-open.png"],
                (1070, 109, 1435, 157),
                (690, 215, 1410, 310),
                "轨迹宿主栏 · 放大",
            )
            draw_box(canvas, (778, 225, 1090, 300), "选择分叉点")
            cursor = cursor_position(progress, 0.10, 0.15, (850, 470), (936, 260))
            if 0.22 <= progress <= 0.29:
                click_phase = (progress - 0.22) / 0.07
                click_box = (778, 225, 1090, 300)
            title = "轨迹精确 Fork：先选择完成 Turn / Event"
            detail = "点击后把目标从最新轮次改为第 20 轮。"
        elif progress < 0.58:
            canvas = IMAGES["trajectory-turn20-selected.png"].copy()
            draw_box(canvas, (1115, 115, 1272, 151), "第 20 轮 · Event 188", GREEN)
            draw_zoom_inset(
                canvas,
                IMAGES["trajectory-turn20-selected.png"],
                (1070, 109, 1435, 157),
                (690, 215, 1410, 310),
                "已选边界与 Fork · 放大",
            )
            draw_box(canvas, (778, 225, 1090, 300), "第 20 轮 · Event 188", GREEN)
            draw_box(canvas, (1263, 225, 1398, 300), "Fork 按钮")
            cursor = cursor_position(progress, 0.39, 0.44, (936, 260), (1329, 260))
            if 0.49 <= progress <= 0.56:
                click_phase = (progress - 0.49) / 0.07
                click_box = (1263, 225, 1398, 300)
            title = "目标已选中：第 20 轮 · Event 188"
            detail = "快速移到 Fork，短暂停留，再出现明确按下态。"
        elif progress < 0.66:
            canvas = blend(
                IMAGES["trajectory-turn20-selected.png"],
                IMAGES["trajectory-fork-after-loaded.png"],
                (progress - 0.58) / 0.08,
            )
            title = "加载真实子 Session"
            detail = "UI 保持在轨迹视图，便于直接核对血缘。"
        else:
            canvas = IMAGES["trajectory-fork-after-loaded.png"].copy()
            draw_box(canvas, (546, 115, 1055, 151), "父 Session · 继承事件 189", GREEN)
            draw_box(canvas, (540, 632, 1427, 692), "fork-21", GREEN)
            title = "子轨迹：父子血缘、继承边界与独立后缀均可见"
            detail = "聊天 Fork 与轨迹 Fork 最终得到相同 Event 语义。"
        draw_caption(canvas, "04 精确", title, detail)

    elif chapter == "summary":
        canvas = EVIDENCE.copy()
        return canvas
    else:
        raise ValueError(chapter)

    if cursor is not None:
        if click_phase is not None:
            draw_click_feedback(canvas, *cursor, click_phase, click_box)
        draw_cursor(
            canvas,
            *cursor,
            pressed=click_phase is not None and click_phase < 0.58,
        )
    return canvas


def convert_audio() -> list[tuple[str, Path, float]]:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    sources = [
        ("intro", AUDIO_DIR / "01-intro.mp3"),
        ("trajectory", AUDIO_DIR / "02-trajectory.mp3"),
        ("restore", AUDIO_DIR / "03-restore.mp3"),
        ("chat_fork", AUDIO_DIR / "04-chat-fork.mp3"),
        ("trajectory_fork", AUDIO_DIR / "05-trajectory-fork.mp3"),
        ("summary", AUDIO_DIR / "06-summary.mp3"),
    ]
    converted: list[tuple[str, Path, float]] = []
    for index, (key, source) in enumerate(sources):
        target = WORK_DIR / f"{index + 1:02d}-{key}.wav"
        subprocess.run(
            [
                str(FFMPEG),
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-ar",
                "48000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                str(target),
            ],
            check=True,
        )
        with wave.open(str(target), "rb") as wav:
            duration = wav.getnframes() / wav.getframerate()
        converted.append((key, target, duration))

    inputs: list[str] = []
    filters: list[str] = []
    labels: list[str] = []
    for index, (_, path, _) in enumerate(converted):
        inputs.extend(["-i", str(path)])
        initial = f",adelay={round(PRELUDE * 1000)}" if index == 0 else ""
        label = f"a{index}"
        filters.append(
            f"[{index}:a]aresample=48000{initial},apad=pad_dur={GAP}[{label}]"
        )
        labels.append(f"[{label}]")
    filters.append(
        "".join(labels)
        + f"concat=n={len(converted)}:v=0:a=1[outa]"
    )
    subprocess.run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            *inputs,
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[outa]",
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(BASE_AUDIO_PATH),
        ],
        check=True,
    )
    return converted


def chapter_timeline(converted: list[tuple[str, Path, float]]) -> list[Chapter]:
    labels = {
        "intro": "开场",
        "trajectory": "完整轨迹",
        "restore": "中断恢复",
        "chat_fork": "聊天快捷 Fork",
        "trajectory_fork": "轨迹精确 Fork",
        "summary": "结论",
    }
    current = PRELUDE
    chapters: list[Chapter] = []
    for key, path, duration in converted:
        chapters.append(
            Chapter(
                key=key,
                label=labels[key],
                audio=path.name,
                start=current,
                end=current + duration + GAP,
            )
        )
        current += duration + GAP
    return chapters


def build_click_audio(chapters: list[Chapter]) -> None:
    with wave.open(str(BASE_AUDIO_PATH), "rb") as base:
        frame_rate = base.getframerate()
        frame_count = base.getnframes()
    if frame_rate != 48000:
        raise ValueError(f"unexpected audio sample rate: {frame_rate}")

    chapter_by_key = {chapter.key: chapter for chapter in chapters}
    click_specs = [
        ("trajectory", 0.61),
        ("restore", 0.645),
        ("chat_fork", 0.345),
        ("trajectory_fork", 0.255),
        ("trajectory_fork", 0.525),
    ]
    click_times = [
        chapter_by_key[key].start
        + (chapter_by_key[key].end - chapter_by_key[key].start) * progress
        for key, progress in click_specs
    ]

    samples = bytearray()
    for index in range(frame_count):
        time = index / frame_rate
        value = 0.0
        for click_time in click_times:
            local = time - click_time
            if 0 <= local < 0.095:
                envelope = math.exp(-42 * local)
                transient = math.sin(2 * math.pi * 1850 * local)
                snap = 0.55 * math.sin(2 * math.pi * 3300 * local)
                value += 0.34 * envelope * (transient + snap)
        value = max(-0.92, min(0.92, value))
        samples.extend(struct.pack("<h", round(value * 32767)))

    with wave.open(str(CLICK_AUDIO_PATH), "wb") as clicks:
        clicks.setnchannels(1)
        clicks.setsampwidth(2)
        clicks.setframerate(frame_rate)
        clicks.writeframes(samples)

    subprocess.run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(BASE_AUDIO_PATH),
            "-i",
            str(CLICK_AUDIO_PATH),
            "-filter_complex",
            "[0:a][1:a]amix=inputs=2:duration=first:normalize=0,"
            "loudnorm=I=-16:LRA=7:TP=-1.5[outa]",
            "-map",
            "[outa]",
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(AUDIO_PATH),
        ],
        check=True,
    )


def frame_for_time(time: float, chapters: list[Chapter]) -> Image.Image:
    if time < chapters[0].start:
        return TITLE.copy()
    chapter = chapters[-1]
    for candidate in chapters:
        if time < candidate.end:
            chapter = candidate
            break
    progress = (time - chapter.start) / max(0.001, chapter.end - chapter.start)
    return chapter_frame(chapter.key, max(0.0, min(1.0, progress)))


def write_video(chapters: list[Chapter]) -> float:
    with wave.open(str(AUDIO_PATH), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
    frame_count = math.ceil(duration * FPS)
    command = [
        str(FFMPEG),
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s:v",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        str(AUDIO_PATH),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-shortest",
        str(VIDEO_PATH),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for index in range(frame_count):
            frame = frame_for_time(index / FPS, chapters)
            process.stdin.write(frame.tobytes())
    finally:
        process.stdin.close()
    return_code = process.wait()
    if return_code != 0:
        raise SystemExit(f"ffmpeg failed with exit code {return_code}")
    return duration


def configure_output(output_dir: Path) -> None:
    global WORK_DIR, VIDEO_PATH, COVER_PATH, AUDIO_PATH, BASE_AUDIO_PATH, CLICK_AUDIO_PATH
    WORK_DIR = output_dir.expanduser().resolve()
    VIDEO_PATH = WORK_DIR / "trajectory-restore-fork-demo.mp4"
    COVER_PATH = WORK_DIR / "cover.jpg"
    AUDIO_PATH = WORK_DIR / "narration.wav"
    BASE_AUDIO_PATH = WORK_DIR / "narration-base.wav"
    CLICK_AUDIO_PATH = WORK_DIR / "clicks.wav"


def resolve_ffmpeg(requested: str | None) -> str:
    candidate = requested or shutil.which("ffmpeg")
    if candidate is None:
        raise SystemExit(
            "ffmpeg was not found; install it, pass --ffmpeg, or set PERIX_DEMO_FFMPEG"
        )
    resolved = shutil.which(candidate)
    path = Path(resolved or candidate).expanduser()
    if not path.is_file():
        raise SystemExit(f"ffmpeg binary not found: {path}")
    return str(path.resolve())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_source_assets() -> None:
    manifest = SCRIPT_DIR / "SHA256SUMS"
    expected: dict[Path, str] = {}
    for line_number, raw_line in enumerate(
        manifest.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split(maxsplit=1)
        if len(fields) != 2:
            raise SystemExit(f"Malformed SHA256SUMS line {line_number}")
        checksum, relative_text = fields
        relative = Path(relative_text.lstrip("* "))
        target = (SCRIPT_DIR / relative).resolve()
        try:
            target.relative_to(SCRIPT_DIR)
        except ValueError as exc:
            raise SystemExit(f"Source manifest path escapes its directory: {relative}") from exc
        if not target.is_file():
            raise SystemExit(f"Source asset is missing: {relative}")
        actual = sha256(target)
        if actual != checksum:
            raise SystemExit(
                f"Source asset checksum mismatch: {relative} ({actual}, expected {checksum})"
            )
        expected[relative] = checksum

    actual_assets = {
        path.relative_to(SCRIPT_DIR)
        for root in (CAPTURES, AUDIO_DIR)
        for path in root.iterdir()
        if path.is_file()
    }
    if actual_assets != set(expected):
        missing = sorted(str(path) for path in set(expected) - actual_assets)
        undeclared = sorted(str(path) for path in actual_assets - set(expected))
        raise SystemExit(
            f"Source manifest inventory mismatch; missing={missing}, undeclared={undeclared}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compose the Nexent Event trajectory restore/Fork documentation demo."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_WORK_DIR,
        help=f"build directory (default: {DEFAULT_WORK_DIR})",
    )
    parser.add_argument(
        "--ffmpeg",
        default=os.environ.get("PERIX_DEMO_FFMPEG"),
        help="ffmpeg executable (default: PERIX_DEMO_FFMPEG or PATH)",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help=f"copy verified output into {PUBLISHED_DIR}",
    )
    return parser.parse_args()


def install_output() -> None:
    PUBLISHED_DIR.mkdir(parents=True, exist_ok=True)
    for source in (VIDEO_PATH, COVER_PATH):
        destination = PUBLISHED_DIR / source.name
        shutil.copy2(source, destination)
        print(f"installed {destination}")


def main() -> None:
    global FFMPEG
    args = parse_args()
    FFMPEG = resolve_ffmpeg(args.ffmpeg)
    configure_output(args.output_dir)
    verify_source_assets()
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    converted = convert_audio()
    chapters = chapter_timeline(converted)
    build_click_audio(chapters)
    COVER_PATH.parent.mkdir(parents=True, exist_ok=True)
    TITLE.save(COVER_PATH, quality=93, optimize=True)
    duration = write_video(chapters)
    for chapter in chapters:
        print(
            f"{chapter.start:06.2f}-{chapter.end:06.2f}  "
            f"{chapter.label}  ({chapter.audio})"
        )
    print(f"duration={duration:.2f}s")
    print(VIDEO_PATH)
    print(COVER_PATH)
    print(f"video_sha256={sha256(VIDEO_PATH)}")
    print(f"cover_sha256={sha256(COVER_PATH)}")
    if args.install:
        install_output()


if __name__ == "__main__":
    main()
