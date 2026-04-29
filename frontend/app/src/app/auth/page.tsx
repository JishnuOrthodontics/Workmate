'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearAllSessions, loginUser, registerUser, setSession } from '../../lib/auth-client'
import { useAuth } from '../auth-provider'

type Role = 'customer' | 'provider'
type Mode = 'login' | 'register'

function AuthPageContent() {
  const { refresh } = useAuth()
  const [role, setRole] = useState<Role>('customer')
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState('')
  const [service, setService] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  useEffect(() => {
    const roleFromQuery = searchParams.get('role')
    if (roleFromQuery === 'provider' || roleFromQuery === 'customer') {
      setRole(roleFromQuery)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !password.trim()) {
      setError('Phone and password are required.')
      return
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Full name is required for registration.')
        return
      }
      if (role === 'customer' && !location.trim()) {
        setError('Location is required for customer registration.')
        return
      }
      if (role === 'provider' && !service.trim()) {
        setError('Primary service is required for provider registration.')
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
        phone: phone.trim(),
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
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
      <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-teal-200/20 blur-3xl"></div>
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl border border-white/70 p-6 shadow-2xl relative z-10">
        <h1 className="font-h2 text-h2 text-emerald-900 mb-2">Login to Workmate</h1>
        <p className="text-stone-600 mb-6">Choose role and continue to your dashboard.</p>

        <div className="flex gap-2 mb-3 p-1 bg-emerald-50 rounded-xl">
          <button
            className={`flex-1 rounded-lg py-2 font-label-md transition-colors ${role === 'customer' ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-sm' : 'text-stone-700'}`}
            onClick={() => setRole('customer')}
            type="button"
          >
            Customer
          </button>
          <button
            className={`flex-1 rounded-lg py-2 font-label-md transition-colors ${role === 'provider' ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-sm' : 'text-stone-700'}`}
            onClick={() => setRole('provider')}
            type="button"
          >
            Provider
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 rounded-xl py-2 font-label-md transition-colors ${mode === 'login' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-700'}`}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={`flex-1 rounded-xl py-2 font-label-md transition-colors ${mode === 'register' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-700'}`}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              type="text"
              value={name}
            />
          )}

          <input
            className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
            value={phone}
          />
          <input
            className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            value={password}
          />

          {mode === 'register' && role === 'customer' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              type="text"
              value={location}
            />
          )}

          {mode === 'register' && role === 'provider' && (
            <input
              className="w-full rounded-xl border border-emerald-100 px-3 py-2 focus:border-emerald-400 focus:ring-emerald-300"
              onChange={(e) => setService(e.target.value)}
              placeholder="Primary service (e.g. Plumbing)"
              type="text"
              value={service}
            />
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 text-white py-2 font-label-md shadow-lg hover:opacity-95 disabled:opacity-70" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? 'Please wait...'
              : mode === 'login'
              ? `Login as ${role === 'customer' ? 'Customer' : 'Provider'}`
              : `Register as ${role === 'customer' ? 'Customer' : 'Provider'}`}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-600">Loading auth...</div>}>
      <AuthPageContent />
    </Suspense>
  )
}
