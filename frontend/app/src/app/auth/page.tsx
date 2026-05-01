'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearAllSessions, loginUser, registerUser, setSession } from '../../lib/auth-client'
import { useAuth } from '../auth-provider'
import { LanguageSwitcher } from '../language-switcher'
import { useLocale } from '../locale-provider'

type Role = 'customer' | 'provider'
type Mode = 'login' | 'register'

function AuthPageContent() {
  const { t } = useLocale()
  const { refresh } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const roleFromUrl = searchParams.get('role')
  const initialRole: Role =
    roleFromUrl === 'provider' || roleFromUrl === 'customer' ? roleFromUrl : 'customer'

  const [role, setRole] = useState<Role>(initialRole)
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState('')
  const [service, setService] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setRoleAndSyncUrl = (nextRole: Role) => {
    setRole(nextRole)
    const p = new URLSearchParams(searchParams.toString())
    p.set('role', nextRole)
    router.replace(`/auth?${p.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const roleFromQuery = searchParams.get('role')
    if (roleFromQuery === 'admin') {
      const n = searchParams.get('next')
      router.replace(n ? `/auth/admin?next=${encodeURIComponent(n)}` : '/auth/admin')
      return
    }
    if (roleFromQuery === 'provider' || roleFromQuery === 'customer') {
      setRole(roleFromQuery)
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !password.trim()) {
      setError(t('auth.errors.phonePasswordRequired'))
      return
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError(t('auth.errors.nameRequired'))
        return
      }
      if (role === 'customer' && !location.trim()) {
        setError(t('auth.errors.locationRequired'))
        return
      }
      if (role === 'provider' && !service.trim()) {
        setError(t('auth.errors.serviceRequired'))
        return
      }
    }

    try {
      setIsSubmitting(true)

      if (mode === 'register') {
        await registerUser({
          name: name.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role,
          location: location.trim(),
          service: service.trim(),
        })
      }

      const loginJson = await loginUser({
        phone: phone.trim().replace(/\s+/g, ''),
        password: password.trim(),
        role,
      })

      const user = loginJson?.data?.user
      const token = loginJson?.data?.token

      clearAllSessions()
      if (role === 'customer') {
        setSession('customer', {
          isAuthenticated: true,
          uid: user?.uid,
          name: user?.name || name.trim() || 'Customer',
          phone: user?.phone || phone.trim(),
          location: user?.location || location.trim() || 'Kerala',
          token,
        })
        refresh()
        router.push(nextPath || '/dashboard')
        return
      }

      setSession('provider', {
        isAuthenticated: true,
        uid: user?.uid,
        name: user?.name || name.trim() || 'Provider',
        phone: user?.phone || phone.trim(),
        service: service.trim() || 'General Services',
        token,
      })
      refresh()
      router.push(nextPath || '/provider/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.authFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute right-4 top-4 z-20 md:right-8 md:top-8">
        <LanguageSwitcher />
      </div>
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-teal-200/20 blur-3xl"></div>
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl border border-white/70 p-6 shadow-2xl relative z-10">
        <h1 className="font-h2 text-h2 text-emerald-900 mb-2">{t('auth.page.title')}</h1>
        <p className="text-stone-600 mb-6">{t('auth.page.subtitle')}</p>

        <div className="flex gap-2 mb-3 p-1 bg-emerald-50 rounded-xl">
          <button
            className={`flex-1 rounded-lg py-2 font-label-md transition-colors ${role === 'customer' ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-sm' : 'text-stone-700'}`}
            onClick={() => setRoleAndSyncUrl('customer')}
            type="button"
          >
            {t('auth.page.customer')}
          </button>
          <button
            className={`flex-1 rounded-lg py-2 font-label-md transition-colors ${role === 'provider' ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-sm' : 'text-stone-700'}`}
            onClick={() => setRoleAndSyncUrl('provider')}
            type="button"
          >
            {t('auth.page.provider')}
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 rounded-xl py-2 font-label-md transition-colors ${mode === 'login' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-700'}`}
            onClick={() => setMode('login')}
            type="button"
          >
            {t('auth.page.login')}
          </button>
          <button
            className={`flex-1 rounded-xl py-2 font-label-md transition-colors ${mode === 'register' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-700'}`}
            onClick={() => setMode('register')}
            type="button"
          >
            {t('auth.page.register')}
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.page.fullName')}
              type="text"
              value={name}
            />
          )}

          <input
            className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('auth.page.phone')}
            type="tel"
            value={phone}
          />
          <input
            className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.page.password')}
            type="password"
            value={password}
          />

          {mode === 'register' && role === 'customer' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('auth.page.location')}
              type="text"
              value={location}
            />
          )}

          {mode === 'register' && role === 'provider' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setService(e.target.value)}
              placeholder={t('auth.page.primaryService')}
              type="text"
              value={service}
            />
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 text-white py-2 font-label-md shadow-lg hover:opacity-95 disabled:opacity-70" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? t('auth.page.pleaseWait')
              : mode === 'login'
              ? role === 'customer'
                ? t('auth.page.loginAsCustomer')
                : t('auth.page.loginAsProvider')
              : role === 'customer'
              ? t('auth.page.registerAsCustomer')
              : t('auth.page.registerAsProvider')}
          </button>
        </form>
      </div>
    </main>
  )
}

function AuthPageSuspenseFallback() {
  const { t } = useLocale()
  return <div className="p-6 text-stone-600">{t('auth.page.loading')}</div>
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageSuspenseFallback />}>
      <AuthPageContent />
    </Suspense>
  )
}
