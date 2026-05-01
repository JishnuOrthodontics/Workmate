'use client'

import { useLayoutEffect } from 'react'
import { useLocale } from './locale-provider'

/** Syncs `<html lang>` and `data-locale` for fonts/CSS after locale is known. */
export function LocaleDocumentSync() {
  const { locale } = useLocale()

  useLayoutEffect(() => {
    document.documentElement.lang = locale === 'ml' ? 'ml' : 'en'
    document.documentElement.setAttribute('data-locale', locale)
  }, [locale])

  return null
}
