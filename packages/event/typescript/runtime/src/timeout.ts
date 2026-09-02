/**
 * Timer bounds.
 *
 * The one constant the retained persistence coordinator needs from DeepSeek
 * Harness `packages/util/timeout/src/index.ts` (0.1.2-alpha.3, dd6322d6).
 * MIT licensed.
 */

/** Largest delay Node schedules without clamping it to one millisecond. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647
