'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { clearAllSessions, loginUser, setSession } from '../../../lib/auth-client'
import { useAuth } from '../../auth-provider'

function AdminLoginContent() {
  const { refresh } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !password.trim()) {
      setError('Phone and password are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const loginJson = await loginUser({
        phone: phone.trim().replace(/\s+/g, ''),
        password: password.trim(),
        role: 'admin',
      })

      const user = loginJson?.data?.user
      const token = loginJson?.data?.token

      clearAllSessions()
      setSession('admin', {
        isAuthenticated: true,
        uid: user?.uid,
        name: user?.name || 'Administrator',
        phone: user?.phone || phone.trim(),
        location: user?.location || 'Kerala',
        token,
      })
      refresh()
      router.push(nextPath || '/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-stone-200 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-stone-300/80 bg-white p-6 shadow-sm">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-stone-500">Workmate</p>
        <h1 className="mt-1 text-center text-lg font-semibold text-stone-800">Platform sign-in</h1>
        <p className="mt-1 text-center text-xs text-stone-500">Authorized staff only</p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-400"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
            autoComplete="username"
            value={phone}
          />
          <input
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-400"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            className="w-full rounded-lg bg-stone-800 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-500">
          <Link className="text-stone-600 underline-offset-2 hover:underline" href="/">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function AdminAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-200 text-stone-600 text-sm">Loading…</div>}>
      <AdminLoginContent />
    </Suspense>
  )
}
