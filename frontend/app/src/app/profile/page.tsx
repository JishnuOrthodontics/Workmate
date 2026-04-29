'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../auth-provider'
import { setSession } from '../../lib/auth-client'

type PaymentStatus = 'initiated' | 'pending' | 'paid' | 'failed'

function ProfilePageContent() {
  const { ready, activeRole, customerSession, refresh } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const providerId = searchParams.get('providerId')

  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [serviceName, setServiceName] = useState('General Home Service')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [paymentState, setPaymentState] = useState<PaymentStatus | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileName, setProfileName] = useState(customerSession?.name || '')
  const [profilePhone, setProfilePhone] = useState(customerSession?.phone || '')
  const [profileLocation, setProfileLocation] = useState(customerSession?.location || '')
  const [profileLanguage, setProfileLanguage] = useState<'en' | 'ml' | 'hi'>('en')
  const [notifySms, setNotifySms] = useState(true)
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!customerSession?.uid || providerId) return
      try {
        const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/profile`)
        const json = await res.json()
        if (!res.ok || !json?.success) return
        setProfileName(json.data.name || '')
        setProfilePhone(json.data.phone || '')
        setProfileLocation(json.data.location || '')
        setProfileLanguage((json.data.language || 'en') as 'en' | 'ml' | 'hi')
        setNotifySms(Boolean(json.data.notifications?.sms))
        setNotifyWhatsapp(Boolean(json.data.notifications?.whatsapp))
        setNotifyPush(Boolean(json.data.notifications?.push))
      } catch {
        // keep local session data as fallback
      }
    }
    loadProfile()
  }, [customerSession?.uid, providerId])

  const handleBookService = async () => {
    if (!providerId) {
      setBookingMessage('Provider ID missing. Please start from search page.')
      return
    }
    const raw = localStorage.getItem('workmate_customer_auth')
    const customer = raw ? JSON.parse(raw) : null
    if (!customer?.uid) {
      router.push(`/auth?role=customer&next=${encodeURIComponent(`/profile?providerId=${providerId}`)}`)
      return
    }

    try {
      setBookingLoading(true)
      setBookingMessage('')
      if (!bookingDate || !bookingTime) throw new Error('Please choose booking date and time.')
      const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`)

      const res = await fetch('http://localhost:3333/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerUid: customer.uid,
          providerId,
          serviceName,
          scheduledAt: scheduledAt.toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Booking failed')

      const paymentRes = await fetch('http://localhost:3333/api/payments/phonepe/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: json.data.id, idempotencyKey: customer.uid }),
      })
      const paymentJson = await paymentRes.json()
      if (!paymentRes.ok || !paymentJson?.success) {
        setPaymentState('failed')
        throw new Error(paymentJson?.error || 'Payment session creation failed')
      }

      setPaymentState('initiated')
      setBookingMessage(`Booking created (ID: ${json.data.id}). Payment session is ready.`)
    } catch (err) {
      setPaymentState((prev) => prev || 'failed')
      setBookingMessage(err instanceof Error ? err.message : 'Booking failed')
    } finally {
      setBookingLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!customerSession?.uid) {
      router.push('/auth?role=customer')
      return
    }
    try {
      setSavingProfile(true)
      setProfileMessage('')
      const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          location: profileLocation,
          language: profileLanguage,
          notifications: { sms: notifySms, whatsapp: notifyWhatsapp, push: notifyPush },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update profile')

      const existing = customerSession
      setSession('customer', {
        ...(existing || { isAuthenticated: true }),
        isAuthenticated: true,
        uid: customerSession.uid,
        name: json.data.name,
        phone: json.data.phone,
        location: json.data.location,
        token: existing?.token,
      })
      refresh()
      setProfileMessage('Profile updated successfully.')
      setIsEditing(false)
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black text-emerald-900">{providerId ? 'Book Provider' : 'My Account'}</h1>
          <a
            className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white"
            href={ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth'}
          >
            {ready && activeRole ? 'Dashboard' : 'Login'}
          </a>
        </div>

        {!providerId ? (
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-emerald-900">Customer Profile</h2>
              <button
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                onClick={() => setIsEditing((v) => !v)}
                type="button"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            <p className="mt-1 text-sm text-stone-600">This page is your account view. Provider details open only from search results.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">Name</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileName(e.target.value)} type="text" value={profileName} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.name || 'Customer'}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">Phone</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfilePhone(e.target.value)} type="tel" value={profilePhone} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.phone || '-'}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">Location</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileLocation(e.target.value)} type="text" value={profileLocation} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.location || '-'}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">Language</p>
                {isEditing ? (
                  <select className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileLanguage(e.target.value as 'en' | 'ml' | 'hi')} value={profileLanguage}>
                    <option value="en">English</option>
                    <option value="ml">Malayalam</option>
                    <option value="hi">Hindi</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-stone-800 uppercase">{profileLanguage}</p>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <p className="text-xs uppercase text-emerald-700">Notifications</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-700">
                <label className="flex items-center gap-2">
                  <input checked={notifySms} disabled={!isEditing} onChange={(e) => setNotifySms(e.target.checked)} type="checkbox" />
                  SMS
                </label>
                <label className="flex items-center gap-2">
                  <input checked={notifyWhatsapp} disabled={!isEditing} onChange={(e) => setNotifyWhatsapp(e.target.checked)} type="checkbox" />
                  WhatsApp
                </label>
                <label className="flex items-center gap-2">
                  <input checked={notifyPush} disabled={!isEditing} onChange={(e) => setNotifyPush(e.target.checked)} type="checkbox" />
                  Push
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <a className="text-sm font-semibold text-emerald-800 underline" href="/search">
                Find providers and book service
              </a>
              {isEditing ? (
                <button className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70" disabled={savingProfile} onClick={handleSaveProfile} type="button">
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              ) : null}
            </div>
            {profileMessage ? <p className="mt-3 text-xs text-stone-600">{profileMessage}</p> : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-emerald-900">Booking Details</h2>
            <p className="mt-1 text-sm text-stone-600">Confirm your requirement and initiate payment.</p>
            <div className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-sm"
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Service needed"
                type="text"
                value={serviceName}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-xl border border-emerald-100 px-3 py-2 text-sm"
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setBookingDate(e.target.value)}
                  type="date"
                  value={bookingDate}
                />
                <input
                  className="rounded-xl border border-emerald-100 px-3 py-2 text-sm"
                  onChange={(e) => setBookingTime(e.target.value)}
                  type="time"
                  value={bookingTime}
                />
              </div>
              <button
                className="w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 py-3 text-white disabled:opacity-70"
                disabled={bookingLoading}
                onClick={handleBookService}
                type="button"
              >
                {bookingLoading ? 'Booking...' : 'Book and Pay'}
              </button>
              {bookingMessage ? <p className="text-xs text-stone-600">{bookingMessage}</p> : null}
              {paymentState ? (
                <p className="text-sm text-emerald-700">
                  Payment status: {paymentState === 'initiated' ? 'Initiated (PhonePe sandbox)' : paymentState}
                </p>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-600">Loading profile...</div>}>
      <ProfilePageContent />
    </Suspense>
  )
}
