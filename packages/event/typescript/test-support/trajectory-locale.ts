import { en as commonEn } from '../packages/client/locale/src/locales/en.ts'
import { zh as commonZh } from '../packages/client/locale/src/locales/zh.ts'
import {
  en,
  zh,
  type TrajectoryTranslate,
} from '../packages/client/ui-trajectory/src/client/locales.ts'

function translator(dictionary: Record<string, string>): TrajectoryTranslate {
  return (key, params = {}) => {
    const template = dictionary[key] ?? key
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = params[name]
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : ''
    })
  }
}

/** English trajectory translator for standalone component tests. */
export const t = translator({ ...commonEn, ...en })

/** Chinese trajectory translator for standalone component tests. */
export const tZh = translator({ ...commonZh, ...zh })
