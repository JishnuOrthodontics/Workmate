'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { getMessage } from '../i18n/get-message'
import type { AppLocale } from '../i18n/types'
import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from '../i18n/types'

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (next: AppLocale) => void
  t: (key: string, vars?: Record<string, string>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en'
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('lang')
    if (fromQuery === 'ml' || fromQuery === 'en') return fromQuery
  } catch {
    // ignore
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'ml' || stored === 'en') return stored
  } catch {
    // ignore
  }
  return 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en')

  useLayoutEffect(() => {
    setLocaleState(readInitialLocale())
  }, [])

  const setLocale = useCallback((next: AppLocale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return
    setLocaleState(next)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => getMessage(locale, key, vars),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
