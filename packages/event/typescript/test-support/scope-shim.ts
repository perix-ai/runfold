/**
 * Test-only stand-in for `@deepseek-ai/dsh-scope`. The Perix host has no
 * scope-filtered dispatch, so carriers are the subjects themselves and every
 * listener hears every session. Aliased in `vitest.config.ts`; never built.
 */

import type { Context } from './cordis-shim.ts'

export type ScopeKey = object
export type Scoped<T extends object> = T

export interface Scope {
  ctx: Context
  rawDispose: () => Promise<void> | void
  dispose(): Promise<void>
}

export function scopeOf(_ctx: Context): ScopeKey | undefined {
  return undefined
}

export function scopeTarget<T extends object>(base: T, _key: ScopeKey | undefined): Scoped<T> {
  return base
}

export function createScope(ctx: Context, _key: ScopeKey): Scope {
  const child = ctx.scope()
  return {
    ctx: child,
    rawDispose: () => child.dispose(),
    dispose: () => child.dispose(),
  }
}
