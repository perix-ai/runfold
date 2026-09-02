/**
 * Standalone barrel for the exact DeepSeek Harness UI primitives reached by
 * Trajectory. Implementations remain in their pinned upstream paths so their
 * bytes stay auditable; this file replaces only the original package barrel.
 */
export { JsonTree } from '../../../packages/client/ui-primitives/src/JsonTree.tsx'
export type {
  JsonTreeLabels,
  JsonTreeProps,
} from '../../../packages/client/ui-primitives/src/JsonTree.tsx'
export { Tooltip } from '../../../packages/client/ui-primitives/src/Tooltip.tsx'
export type { TooltipSide } from '../../../packages/client/ui-primitives/src/Tooltip.tsx'
export { MarkdownText } from '../../../packages/client/ui-primitives/src/markdown/MarkdownText.tsx'
export type {
  MarkdownCodeLabels,
  MarkdownFileMentions,
  MarkdownLabels,
} from '../../../packages/client/ui-primitives/src/markdown/MarkdownText.tsx'
export {
  extractMarkdownPlainText,
} from '../../../packages/client/ui-primitives/src/markdown/plain-text.ts'
export type {
  MarkdownPlainTextMode,
  MarkdownPlainTextOptions,
} from '../../../packages/client/ui-primitives/src/markdown/plain-text.ts'
export {
  IconChevronRightOutline14,
  IconSearchOutline16,
  IconSettingsOutline16,
  IconSparkle16,
  IconUserOutline16,
} from '../../../packages/client/ui-primitives/src/icons/index.tsx'
