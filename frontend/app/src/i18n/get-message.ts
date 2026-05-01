import type { AppLocale } from './types'
import en from './messages/en.json'
import ml from './messages/ml.json'

const catalogs: Record<AppLocale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  ml: ml as Record<string, unknown>,
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const p of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[p]
  }
  return current
}

/** Replace `{key}` placeholders in a string. */
export function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

export function getMessage(locale: AppLocale, key: string, vars?: Record<string, string>): string {
  const raw = getNested(catalogs[locale], key)
  if (typeof raw === 'string') return interpolate(raw, vars)
  const fallback = getNested(catalogs.en, key)
  if (typeof fallback === 'string') return interpolate(fallback, vars)
  return key
}
