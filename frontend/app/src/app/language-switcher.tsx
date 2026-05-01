'use client'

import { useLocale } from './locale-provider'
import type { AppLocale } from '../i18n/types'

type LanguageSwitcherProps = {
  className?: string
  variant?: 'default' | 'compact'
}

export function LanguageSwitcher({ className = '', variant = 'default' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale()

  const cycle = (next: AppLocale) => setLocale(next)

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white/90 p-0.5 text-xs shadow-sm ${className}`}>
        <button
          aria-pressed={locale === 'en'}
          className={`rounded-md px-2 py-1 font-semibold ${locale === 'en' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
          onClick={() => cycle('en')}
          type="button"
        >
          EN
        </button>
        <button
          aria-pressed={locale === 'ml'}
          className={`rounded-md px-2 py-1 font-semibold ${locale === 'ml' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
          onClick={() => cycle('ml')}
          type="button"
        >
          മലയാളം
        </button>
      </div>
    )
  }

  return (
    <div className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span className="sr-only">{t('nav.siteLanguage')}</span>
      <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/90 p-0.5 text-xs shadow-sm">
        <button
          aria-pressed={locale === 'en'}
          className={`rounded-full px-2.5 py-1 font-semibold ${locale === 'en' ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-emerald-50'}`}
          onClick={() => cycle('en')}
          type="button"
        >
          EN
        </button>
        <button
          aria-pressed={locale === 'ml'}
          className={`rounded-full px-2.5 py-1 font-semibold ${locale === 'ml' ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-emerald-50'}`}
          onClick={() => cycle('ml')}
          type="button"
        >
          മലയാളം
        </button>
      </div>
    </div>
  )
}
