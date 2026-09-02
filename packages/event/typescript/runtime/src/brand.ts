/**
 * Nominal string brands.
 *
 * Copied from DeepSeek Harness `packages/util/brand/src/index.ts`
 * (0.1.2-alpha.3, dd6322d6). MIT licensed. The brand symbol is declared once
 * here so every id type in the Event SDK shares one nominal identity.
 */

declare const BRAND: unique symbol

/** A string carrying a compile-time-only nominal tag `B`. */
export type Branded<B extends string> = string & { readonly [BRAND]: B }

/**
 * Brand a string without validation.
 * @param value - the raw or already-branded string.
 * @returns the same string typed as `T`.
 */
export function brandString<T extends Branded<string>>(value: string | T): T {
  return value as T
}
