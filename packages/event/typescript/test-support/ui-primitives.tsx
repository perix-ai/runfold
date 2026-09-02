/**
 * Test-only subset of the pinned ui-primitives locale and Markdown wrappers.
 * The values are copied from
 * `packages/client/ui-primitives/tests/{labels.client,markdown-test-components}.tsx`
 * at DeepSeek Harness commit dd6322d604e00eec1ba5e0c8541159906a21094a.
 */
import { createElement, type ComponentProps } from 'react'
import {
  MarkdownText as LocalizedMarkdownText,
  type JsonTreeLabels,
  type MarkdownCodeLabels,
  type MarkdownLabels,
} from '../ui/trajectory/src/ui-primitives.ts'

export const markdownLabels: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '复制成功' },
  footnotes: 'Footnotes',
}

export const jsonTreeLabels: JsonTreeLabels = {
  copyValue: 'Copy value', copyJson: 'Copy JSON', copyPath: 'Copy property path',
  copyPrettyJson: 'Copy pretty JSON', copyCompactJson: 'Copy compact JSON',
  copied: 'Copied', copyFailed: 'Copy failed',
  collapseNode: 'Collapse JSON node', expandNode: 'Expand JSON node',
  copyButtonTitle: action => `${action}; right-click for copy options`,
}

type MarkdownTextProps = Omit<ComponentProps<typeof LocalizedMarkdownText>, 'labels'> & {
  labels?: MarkdownLabels
  codeLabels?: MarkdownCodeLabels
}

export function MarkdownText({
  labels,
  codeLabels,
  ...props
}: MarkdownTextProps) {
  const resolved = labels ?? (codeLabels === undefined
    ? markdownLabels
    : { ...markdownLabels, code: codeLabels })
  return createElement(LocalizedMarkdownText, { ...props, labels: resolved })
}
