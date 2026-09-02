/**
 * Vitest setup for jsdom runs. Node 22+ installs a `localStorage` global whose
 * accessor yields an object without Storage methods unless the process was
 * started with `--localstorage-file`; under vitest's jsdom environment that
 * accessor shadows the window storage the retained UI code and the upstream
 * view tests rely on. Replace it with an in-memory Storage before any test
 * module is imported.
 */

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(String(key)) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.entries.set(String(key), String(value))
  }
}

if (typeof window !== 'undefined') {
  const current = (globalThis as { localStorage?: Partial<Storage> }).localStorage
  if (typeof current?.clear !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}
