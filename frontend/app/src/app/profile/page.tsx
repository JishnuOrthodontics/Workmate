'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../auth-provider'
import { setSession } from '../../lib/auth-client'
import { useLocale } from '../locale-provider'
import { LanguageSwitcher } from '../language-switcher'

type PaymentStatus = 'initiated' | 'pending' | 'paid' | 'failed'
const PENDING_PAYMENT_KEY = 'workmate_pending_payment'

type PendingPayment = {
  jobId: string;
  customerUid: string;
  providerId: string;
  serviceName: string;
  scheduledAt: string;
}

type ProviderProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl: string;
  title: string;
  location: string;
  services: string[];
  serviceHighlights: Array<{ name: string; description: string; icon?: string; charge?: number }>;
  gallery: string[];
  aboutShort: string;
  aboutLong: string;
  languages: Array<'en' | 'ml' | 'hi'>;
  hourlyRateFrom: number;
  rating: number;
  ratingCount?: number;
  yearsExperience: number;
  availabilityTags: string[];
}

type ProviderOwnProfile = {
  name: string;
  phone: string;
  location: string;
  languages: Array<'en' | 'ml' | 'hi'>;
  avatarUrl: string;
  bannerUrl: string;
  services: string[];
  yearsExperience: number;
  hourlyRateFrom: number;
  title: string;
  aboutTitle: string;
  aboutDescription: string;
  gallery: string[];
  serviceHighlights: Array<{ name: string; description: string; icon?: string; charge?: number }>;
  availabilityDays: number[];
  isOnline: boolean;
}

function ProfilePageContent() {
  const { ready, activeRole, customerSession, providerSession, refresh } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const providerId = searchParams.get('providerId')
  const { t, locale } = useLocale()

  const providerLanguageOptions = useMemo<Array<{ code: 'en' | 'ml' | 'hi'; label: string }>>(
    () => [
      { code: 'en', label: t('providerEditor.spoken.en') },
      { code: 'ml', label: t('providerEditor.spoken.ml') },
      { code: 'hi', label: t('providerEditor.spoken.hi') },
    ],
    [t, locale]
  )

  const dayLabels = useMemo(
    () => [
      t('providerEditor.days.sun'),
      t('providerEditor.days.mon'),
      t('providerEditor.days.tue'),
      t('providerEditor.days.wed'),
      t('providerEditor.days.thu'),
      t('providerEditor.days.fri'),
      t('providerEditor.days.sat'),
    ],
    [t, locale]
  )

  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [serviceName, setServiceName] = useState('General Home Service')
  const [bookingNotes, setBookingNotes] = useState('')
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
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [providerLoading, setProviderLoading] = useState(false)
  const [providerError, setProviderError] = useState('')
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null)
  const [isProviderSaved, setIsProviderSaved] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [providerOwn, setProviderOwn] = useState<ProviderOwnProfile>({
    name: providerSession?.name || '',
    phone: providerSession?.phone || '',
    location: providerSession?.location || '',
    languages: ['en'],
    avatarUrl: '',
    bannerUrl: '',
    services: [],
    yearsExperience: 0,
    hourlyRateFrom: 0,
    title: '',
    aboutTitle: '',
    aboutDescription: '',
    gallery: [],
    serviceHighlights: [],
    availabilityDays: [],
    isOnline: false,
  })
  const [providerProfileMessage, setProviderProfileMessage] = useState('')

  const savePendingPayment = (data: PendingPayment) => {
    localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(data))
    setPendingPayment(data)
  }

  const clearPendingPayment = () => {
    localStorage.removeItem(PENDING_PAYMENT_KEY)
    setPendingPayment(null)
  }

  const createPaymentForJob = async (jobId: string, token: string, idempotencyKey: string) => {
    const paymentRes = await fetch('http://localhost:3333/api/payments/phonepe/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobId, idempotencyKey }),
    })
    const paymentJson = await paymentRes.json()
    if (!paymentRes.ok || !paymentJson?.success) {
      throw new Error(paymentJson?.error || 'Payment session creation failed')
    }
    const paymentUrl = paymentJson?.data?.paymentUrl as string | undefined
    if (paymentUrl) {
      window.open(paymentUrl, '_blank', 'noopener,noreferrer')
    }
    return paymentJson
  }

  useEffect(() => {
    const loadProfile = async () => {
      if (!customerSession?.uid || !customerSession?.token || providerId) return
      try {
        const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/profile`, {
          headers: { Authorization: `Bearer ${customerSession.token}` },
        })
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
  }, [customerSession?.uid, customerSession?.token, providerId])

  useEffect(() => {
    const loadProvider = async () => {
      if (!providerId) return
      try {
        setProviderLoading(true)
        setProviderError('')
        const res = await fetch(`http://localhost:3333/api/providers/${providerId}/public-profile`)
        const json = await res.json()
        if (!res.ok || !json?.success) throw new Error(json?.error || t('profilePage.providerPublic.loadFailed'))
        setProviderProfile(json.data as ProviderProfile)
      } catch (err) {
        setProviderError(err instanceof Error ? err.message : t('profilePage.providerPublic.loadFailed'))
        setProviderProfile(null)
      } finally {
        setProviderLoading(false)
      }
    }
    loadProvider()
  }, [providerId, t])

  useEffect(() => {
    const loadSavedState = async () => {
      if (!providerId || !customerSession?.uid || !customerSession?.token) {
        setIsProviderSaved(false)
        return
      }
      try {
        const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/saved-providers`, {
          headers: { Authorization: `Bearer ${customerSession.token}` },
        })
        const json = await res.json()
        if (!res.ok || !json?.success) return
        const savedIds = (json.data || []).map((x: { id: string }) => String(x.id))
        setIsProviderSaved(savedIds.includes(providerId))
      } catch {
        // ignore saved-state load failures
      }
    }
    loadSavedState()
  }, [providerId, customerSession?.uid, customerSession?.token])

  useEffect(() => {
    const loadProviderOwnProfile = async () => {
      if (providerId || activeRole !== 'provider' || !providerSession?.uid || !providerSession?.token) return
      try {
        const res = await fetch(`http://localhost:3333/api/providers/${providerSession.uid}/profile`, {
          headers: { Authorization: `Bearer ${providerSession.token}` },
        })
        const json = await res.json()
        if (!res.ok || !json?.success) return
        setProviderOwn({
          name: json.data.name || '',
          phone: json.data.phone || '',
          location: json.data.location || '',
          languages: (
            Array.isArray(json.data.languages) && json.data.languages.length > 0
              ? json.data.languages
              : [json.data.language || 'en']
          ) as Array<'en' | 'ml' | 'hi'>,
          avatarUrl: json.data.avatarUrl || '',
          bannerUrl: json.data.bannerUrl || '',
          services: (json.data.services || []) as string[],
          yearsExperience: Number(json.data.yearsExperience || 0),
          hourlyRateFrom: Number(json.data.hourlyRateFrom || 0),
          title: json.data.title || '',
          aboutTitle: json.data.aboutShort || '',
          aboutDescription: json.data.aboutLong || '',
          gallery: (json.data.gallery || []) as string[],
          serviceHighlights: (json.data.serviceHighlights || []) as Array<{ name: string; description: string; icon?: string; charge?: number }>,
          availabilityDays: (json.data.availabilityDays || []) as number[],
          isOnline: Boolean(json.data.isOnline),
        })
      } catch {
        // keep session fallback
      }
    }
    loadProviderOwnProfile()
  }, [providerId, activeRole, providerSession?.uid, providerSession?.token])

  useEffect(() => {
    if (!customerSession?.uid || !customerSession?.token) return
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY)
    if (!raw) return
    try {
      const pending = JSON.parse(raw) as PendingPayment
      if (pending.customerUid !== customerSession.uid) return
      setPendingPayment(pending)
      fetch(`http://localhost:3333/api/payments/bookings/${pending.jobId}/status`, {
        headers: { Authorization: `Bearer ${customerSession.token}` },
      })
        .then((res) => res.json())
        .then((json) => {
          const status = String(json?.data?.paymentStatus || '')
          if (status === 'captured' || status === 'released') {
            clearPendingPayment()
            setPaymentState('paid')
          }
        })
        .catch(() => {
          // keep pending state if status check fails
        })
    } catch {
      localStorage.removeItem(PENDING_PAYMENT_KEY)
    }
  }, [customerSession?.uid, customerSession?.token])

  const handleBookService = async () => {
    if (!providerId) {
      setBookingMessage(t('profilePage.messages.providerMissing'))
      return
    }
    const raw = localStorage.getItem('workmate_customer_auth')
    const customer = raw ? JSON.parse(raw) : null
    if (!customer?.uid || !customer?.token) {
      router.push(`/auth?role=customer&next=${encodeURIComponent(`/profile?providerId=${providerId}`)}`)
      return
    }

    try {
      setBookingLoading(true)
      setBookingMessage('')
      const cleanServiceName = serviceName.trim().replace(/\s+/g, ' ')
      if (!cleanServiceName) throw new Error(t('profilePage.errors.needServiceName'))
      if (!bookingDate || !bookingTime) throw new Error(t('profilePage.errors.needDateTime'))
      const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`)
      if (Number.isNaN(scheduledAt.getTime())) throw new Error(t('profilePage.errors.invalidDateTime'))
      if (scheduledAt.getTime() < Date.now() + 15 * 60 * 1000) {
        throw new Error(t('profilePage.errors.timeTooSoon'))
      }

      const res = await fetch('http://localhost:3333/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
        body: JSON.stringify({
          customerUid: customer.uid,
          providerId,
          serviceName: cleanServiceName,
          notes: bookingNotes.trim(),
          scheduledAt: scheduledAt.toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || t('profilePage.errors.bookingFailed'))

      savePendingPayment({
        jobId: json.data.id,
        customerUid: customer.uid,
        providerId,
        serviceName,
        scheduledAt: scheduledAt.toISOString(),
      })
      await createPaymentForJob(json.data.id, customer.token, customer.uid)

      setPaymentState('initiated')
      setBookingMessage(t('profilePage.messages.bookingCreated', { jobId: String(json.data.id) }))
    } catch (err) {
      setPaymentState((prev) => prev || 'failed')
      setBookingMessage(err instanceof Error ? err.message : t('profilePage.messages.bookingPaymentFailed'))
    } finally {
      setBookingLoading(false)
    }
  }

  const handleResumePayment = async () => {
    if (!pendingPayment || !customerSession?.token || !customerSession?.uid) return
    try {
      setBookingLoading(true)
      setBookingMessage('')
      await createPaymentForJob(pendingPayment.jobId, customerSession.token, customerSession.uid)
      setPaymentState('initiated')
      setBookingMessage(t('profilePage.messages.paymentResumed', { jobId: pendingPayment.jobId }))
    } catch (err) {
      setPaymentState('failed')
      setBookingMessage(err instanceof Error ? err.message : t('profilePage.messages.resumePaymentFailed'))
    } finally {
      setBookingLoading(false)
    }
  }

  const toggleSaveProvider = async () => {
    if (!providerId) return
    if (!customerSession?.uid || !customerSession?.token) {
      router.push(`/auth?role=customer&next=${encodeURIComponent(`/profile?providerId=${providerId}`)}`)
      return
    }
    try {
      setSavingProvider(true)
      setBookingMessage('')
      const method = isProviderSaved ? 'DELETE' : 'POST'
      const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/saved-providers/${providerId}`, {
        method,
        headers: { Authorization: `Bearer ${customerSession.token}` },
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || t('profilePage.messages.updateSavedFailed'))
      setIsProviderSaved(!isProviderSaved)
      setBookingMessage(isProviderSaved ? t('profilePage.messages.savedProviderRemoved') : t('profilePage.messages.savedProviderAdded'))
    } catch (err) {
      setBookingMessage(err instanceof Error ? err.message : t('profilePage.messages.updateSavedFailed'))
    } finally {
      setSavingProvider(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!customerSession?.uid || !customerSession?.token) {
      router.push('/auth?role=customer')
      return
    }
    try {
      setSavingProfile(true)
      setProfileMessage('')
      const res = await fetch(`http://localhost:3333/api/customers/${customerSession.uid}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerSession.token}` },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          location: profileLocation,
          language: profileLanguage,
          notifications: { sms: notifySms, whatsapp: notifyWhatsapp, push: notifyPush },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || t('profilePage.messages.failedSaveProfile'))

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
      setProfileMessage(t('profilePage.messages.profileUpdated'))
      setIsEditing(false)
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : t('profilePage.messages.failedSaveProfile'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveProviderProfile = async () => {
    if (!providerSession?.uid || !providerSession?.token) {
      router.push('/auth?role=provider')
      return
    }
    try {
      setSavingProfile(true)
      setProviderProfileMessage('')
      const res = await fetch(`http://localhost:3333/api/providers/${providerSession.uid}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerSession.token}` },
        body: JSON.stringify({
          name: providerOwn.name,
          phone: providerOwn.phone,
          location: providerOwn.location,
          languages: providerOwn.languages,
          language: providerOwn.languages[0] || 'en',
          avatarUrl: providerOwn.avatarUrl,
          bannerUrl: providerOwn.bannerUrl,
          services:
            providerOwn.serviceHighlights.length > 0
              ? providerOwn.serviceHighlights.map((x) => x.name).filter(Boolean)
              : providerOwn.services,
          yearsExperience: providerOwn.yearsExperience,
          hourlyRateFrom: providerOwn.hourlyRateFrom,
          title: providerOwn.title,
          aboutShort: providerOwn.aboutTitle,
          aboutLong: providerOwn.aboutDescription,
          gallery: providerOwn.gallery,
          serviceHighlights: providerOwn.serviceHighlights,
          availabilityDays: providerOwn.availabilityDays,
          isOnline: providerOwn.isOnline,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || t('profilePage.messages.failedUpdateProvider'))

      setSession('provider', {
        ...(providerSession || { isAuthenticated: true }),
        isAuthenticated: true,
        uid: providerSession.uid,
        name: json.data.name,
        phone: json.data.phone,
        location: json.data.location,
        token: providerSession.token,
      })
      setProviderOwn((prev) => ({
        ...prev,
        avatarUrl: json.data.avatarUrl || '',
        bannerUrl: json.data.bannerUrl || '',
        services: (json.data.services || []) as string[],
        yearsExperience: Number(json.data.yearsExperience || 0),
        hourlyRateFrom: Number(json.data.hourlyRateFrom || 0),
        title: json.data.title || '',
        aboutTitle: json.data.aboutShort || '',
        aboutDescription: json.data.aboutLong || '',
        gallery: (json.data.gallery || []) as string[],
        serviceHighlights: (json.data.serviceHighlights || []) as Array<{ name: string; description: string; icon?: string; charge?: number }>,
        availabilityDays: (json.data.availabilityDays || []) as number[],
        isOnline: Boolean(json.data.isOnline),
        languages: (
          Array.isArray(json.data.languages) && json.data.languages.length > 0
            ? json.data.languages
            : [json.data.language || 'en']
        ) as Array<'en' | 'ml' | 'hi'>,
      }))
      refresh()
      setProviderProfileMessage(t('profilePage.messages.providerProfileUpdated'))
      setIsEditing(false)
    } catch (err) {
      setProviderProfileMessage(err instanceof Error ? err.message : t('providerEditor.messages.failedSave'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleProviderGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files).slice(0, 6)
    const dataUrls = await Promise.all(
      fileArray.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(new Error('Failed to read image'))
            reader.readAsDataURL(file)
          })
      )
    )
    setProviderOwn((p) => ({
      ...p,
      gallery: [...p.gallery, ...dataUrls].slice(0, 12),
    }))
  }

  const uploadSingleImageAsDataUrl = async (file: File): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })

  const providerServiceCards = useMemo(() => {
    if (providerProfile?.serviceHighlights && providerProfile.serviceHighlights.length > 0) {
      return providerProfile.serviceHighlights
    }
    return (providerProfile?.services || []).map((service) => ({
      name: service,
      description: t('profilePage.providerPublic.fallbackServiceDescription', { service: service.toLowerCase() }),
      charge: providerProfile?.hourlyRateFrom || 0,
    }))
  }, [providerProfile, t, locale])

  const providerGallery =
    providerProfile?.gallery && providerProfile.gallery.length > 0
      ? providerProfile.gallery
      : [
          'https://images.unsplash.com/photo-1620626011761-996317b8d101?q=80&w=1200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=1200&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200&auto=format&fit=crop',
        ]
  const recommendedServices = providerServiceCards.slice(0, 5)
  const selectedServiceCard = providerServiceCards.find(
    (service) => service.name.trim().toLowerCase() === serviceName.trim().toLowerCase()
  )
  const estimatedRate = Number(selectedServiceCard?.charge || providerProfile?.hourlyRateFrom || 0)

  const paymentStatusLabel = (state: string) => {
    if (state === 'initiated') return t('profilePage.paymentStatus.initiated')
    if (state === 'pending') return t('profilePage.paymentStatus.pending')
    if (state === 'paid') return t('profilePage.paymentStatus.paid')
    if (state === 'failed') return t('profilePage.paymentStatus.failed')
    return state
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-emerald-900">
            {providerId
              ? t('profilePage.header.bookProvider')
              : activeRole === 'provider'
                ? t('profilePage.header.providerProfile')
                : t('profilePage.header.myAccount')}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <a
              className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white"
              href={ready && activeRole === 'admin' ? '/admin/dashboard' : ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth'}
            >
              {ready && activeRole ? t('profilePage.header.dashboard') : t('profilePage.header.login')}
            </a>
          </div>
        </div>

        {!providerId ? (
          activeRole === 'provider' ? (
            <section className="rounded-3xl border border-emerald-100/90 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-[0_12px_32px_rgba(16,84,58,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-emerald-900">{t('providerEditor.title')}</h2>
                <button
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
                  onClick={() => setIsEditing((v) => !v)}
                  type="button"
                >
                  {isEditing ? t('providerEditor.cancel') : t('providerEditor.editProfile')}
                </button>
              </div>
              <p className="mt-1 text-sm text-stone-600">{t('providerEditor.intro')}</p>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2 overflow-hidden rounded-xl border border-emerald-100 bg-white">
                  <div className="relative h-36 bg-emerald-100">
                    {providerOwn.bannerUrl ? <img alt={t('providerEditor.bannerAlt')} className="h-full w-full object-cover" src={providerOwn.bannerUrl} /> : null}
                    {isEditing ? (
                      <>
                        <input
                          accept="image/*"
                          className="hidden"
                          id="provider-banner-upload"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const dataUrl = await uploadSingleImageAsDataUrl(file)
                            setProviderOwn((p) => ({ ...p, bannerUrl: dataUrl }))
                          }}
                          type="file"
                        />
                        <label
                          className="absolute right-3 top-3 cursor-pointer rounded-xl bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black/80"
                          htmlFor="provider-banner-upload"
                        >
                          {t('providerEditor.changeBanner')}
                        </label>
                      </>
                    ) : null}
                  </div>
                  <div className="relative p-4 pt-12">
                    <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-xl border-4 border-white bg-emerald-100 shadow">
                      {providerOwn.avatarUrl ? (
                        <img alt={t('providerEditor.avatarAlt')} className="h-full w-full object-cover" src={providerOwn.avatarUrl} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-black text-emerald-800">
                          {(providerOwn.name || 'PR').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <>
                        <input
                          accept="image/*"
                          className="hidden"
                          id="provider-avatar-upload"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const dataUrl = await uploadSingleImageAsDataUrl(file)
                            setProviderOwn((p) => ({ ...p, avatarUrl: dataUrl }))
                          }}
                          type="file"
                        />
                        <label
                          className="inline-block cursor-pointer rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                          htmlFor="provider-avatar-upload"
                        >
                          {t('providerEditor.changePhoto')}
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.name')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, name: e.target.value }))} type="text" value={providerOwn.name} />
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">{providerOwn.name || t('providerEditor.defaultProviderName')}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.phone')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, phone: e.target.value }))} type="tel" value={providerOwn.phone} />
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">{providerOwn.phone || '-'}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.location')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, location: e.target.value }))} type="text" value={providerOwn.location} />
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">{providerOwn.location || '-'}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.languages')}</p>
                  {isEditing ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {providerLanguageOptions.map((item) => {
                        const selected = providerOwn.languages.includes(item.code)
                        return (
                          <button
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              selected
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                            }`}
                            key={item.code}
                            onClick={() =>
                              setProviderOwn((p) => ({
                                ...p,
                                languages: p.languages.includes(item.code)
                                  ? (p.languages.length > 1 ? p.languages.filter((x) => x !== item.code) : p.languages)
                                  : [...p.languages, item.code],
                              }))
                            }
                            type="button"
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">
                      {providerOwn.languages.length > 0
                        ? providerOwn.languages
                            .map((code) => providerLanguageOptions.find((x) => x.code === code)?.label || code.toUpperCase())
                            .join(', ')
                        : t('providerEditor.notSpecified')}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.profileTitle')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, title: e.target.value }))} type="text" value={providerOwn.title} />
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">{providerOwn.title || '-'}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.yearsExperience')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" min={0} onChange={(e) => setProviderOwn((p) => ({ ...p, yearsExperience: Number(e.target.value || 0) }))} type="number" value={providerOwn.yearsExperience} />
                  ) : (
                    <p className="text-sm font-semibold text-stone-800">{t('providerEditor.yearsUnit', { years: String(providerOwn.yearsExperience) })}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.aboutTitle')}</p>
                  {isEditing ? (
                    <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, aboutTitle: e.target.value }))} placeholder={t('providerEditor.placeholders.aboutTitle')} type="text" value={providerOwn.aboutTitle} />
                  ) : (
                    <p className="text-sm text-stone-800">{providerOwn.aboutTitle || '-'}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.aboutDescription')}</p>
                  {isEditing ? (
                    <textarea className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, aboutDescription: e.target.value }))} placeholder={t('providerEditor.placeholders.aboutDescription')} rows={4} value={providerOwn.aboutDescription} />
                  ) : (
                    <p className="text-sm text-stone-800 whitespace-pre-wrap">{providerOwn.aboutDescription || '-'}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.serviceCards')}</p>
                  {isEditing ? (
                    <div className="mt-2 space-y-3">
                      <p className="text-xs text-stone-600">{t('providerEditor.serviceCardsHint')}</p>
                      {providerOwn.serviceHighlights.length > 0 ? (
                        providerOwn.serviceHighlights.map((card, idx) => (
                          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm" key={`${card.name}-${idx}`}>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
                              <div className="md:col-span-2">
                                <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.serviceName')}</p>
                                <input
                                  className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  onChange={(e) =>
                                    setProviderOwn((p) => ({
                                      ...p,
                                      serviceHighlights: p.serviceHighlights.map((x, i) =>
                                        i === idx ? { ...x, name: e.target.value } : x
                                      ),
                                    }))
                                  }
                                  placeholder={t('providerEditor.placeholders.serviceName')}
                                  type="text"
                                  value={card.name}
                                />
                              </div>
                              <div className="md:col-span-3">
                                <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.description')}</p>
                                <input
                                  className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  onChange={(e) =>
                                    setProviderOwn((p) => ({
                                      ...p,
                                      serviceHighlights: p.serviceHighlights.map((x, i) =>
                                        i === idx ? { ...x, description: e.target.value } : x
                                      ),
                                    }))
                                  }
                                  placeholder={t('providerEditor.placeholders.serviceDescription')}
                                  type="text"
                                  value={card.description}
                                />
                              </div>
                              <div className="md:col-span-1">
                                <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.chargePerHr')}</p>
                                <input
                                  className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  min={0}
                                  onChange={(e) =>
                                    setProviderOwn((p) => ({
                                      ...p,
                                      serviceHighlights: p.serviceHighlights.map((x, i) =>
                                        i === idx ? { ...x, charge: Number(e.target.value || 0) } : x
                                      ),
                                    }))
                                  }
                                  type="number"
                                  value={Number(card.charge || 0)}
                                />
                              </div>
                              <div className="md:col-span-2 flex items-end">
                                <button
                                  className="w-full rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                                  onClick={() =>
                                    setProviderOwn((p) => ({
                                      ...p,
                                      serviceHighlights: p.serviceHighlights.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  type="button"
                                >
                                  {t('providerEditor.remove')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-stone-600">{t('providerEditor.noServiceCards')}</p>
                      )}
                      <button
                        className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                        onClick={() =>
                          setProviderOwn((p) => ({
                            ...p,
                            serviceHighlights: [...p.serviceHighlights, { name: '', description: '', charge: 0 }],
                          }))
                        }
                        type="button"
                      >
                        {t('providerEditor.addServiceCard')}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-800">{t('providerEditor.serviceCardsConfigured', { count: String(providerOwn.serviceHighlights.length) })}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.workGallery')}</p>
                  {isEditing ? (
                    <div className="mt-2 space-y-3">
                      <input
                        accept="image/*"
                        className="w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        multiple
                        onChange={(e) => void handleProviderGalleryUpload(e.target.files)}
                        type="file"
                      />
                      {providerOwn.gallery.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {providerOwn.gallery.map((url, idx) => (
                            <div className="relative" key={`${url.slice(0, 24)}-${idx}`}>
                              <img alt={t('providerEditor.galleryAlt')} className="h-20 w-full rounded-lg object-cover" src={url} />
                              <button
                                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                onClick={() =>
                                  setProviderOwn((p) => ({
                                    ...p,
                                    gallery: p.gallery.filter((_, i) => i !== idx),
                                  }))
                                }
                                type="button"
                              >
                                {t('providerEditor.remove')}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-600">{t('providerEditor.noGalleryImages')}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-800">{t('providerEditor.galleryImageCount', { count: String(providerOwn.gallery.length) })}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.availability')}</p>
                  {isEditing ? (
                    <div className="mt-2 space-y-3">
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input className="h-4 w-4 rounded border-emerald-300 accent-emerald-600" checked={providerOwn.isOnline} onChange={(e) => setProviderOwn((p) => ({ ...p, isOnline: e.target.checked }))} type="checkbox" />
                        {t('providerEditor.showOnlineNow')}
                      </label>
                      <div className="flex flex-wrap gap-3 text-sm text-stone-700">
                        {dayLabels.map((dayLabel, idx) => (
                          <label className="flex items-center gap-1" key={dayLabel}>
                            <input
                              className="h-4 w-4 rounded border-emerald-300 accent-emerald-600"
                              checked={providerOwn.availabilityDays.includes(idx)}
                              onChange={(e) =>
                                setProviderOwn((p) => ({
                                  ...p,
                                  availabilityDays: e.target.checked
                                    ? Array.from(new Set([...p.availabilityDays, idx]))
                                    : p.availabilityDays.filter((d) => d !== idx),
                                }))
                              }
                              type="checkbox"
                            />
                            {dayLabel}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-800">
                      {providerOwn.isOnline ? t('providerEditor.onlineNow') : t('providerEditor.offline')} •{' '}
                      {providerOwn.availabilityDays.length > 0
                        ? providerOwn.availabilityDays
                            .sort((a, b) => a - b)
                            .map((d) => dayLabels[d])
                            .join(', ')
                        : t('providerEditor.onRequest')}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <a className="text-sm font-semibold text-emerald-800 underline" href="/provider/dashboard">
                  {t('profilePage.providerOwn.backToDashboard')}
                </a>
                {isEditing ? (
                  <button className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-emerald-800 hover:to-emerald-600 disabled:opacity-70" disabled={savingProfile} onClick={handleSaveProviderProfile} type="button">
                    {savingProfile ? t('providerEditor.saving') : t('providerEditor.saveChanges')}
                  </button>
                ) : null}
              </div>
              {providerProfileMessage ? <p className="mt-3 text-xs text-stone-600">{providerProfileMessage}</p> : null}
            </section>
          ) : (
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-emerald-900">{t('profilePage.customer.title')}</h2>
              <button
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                onClick={() => setIsEditing((v) => !v)}
                type="button"
              >
                {isEditing ? t('providerEditor.cancel') : t('providerEditor.editProfile')}
              </button>
            </div>
            <p className="mt-1 text-sm text-stone-600">{t('profilePage.customer.intro')}</p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.name')}</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileName(e.target.value)} type="text" value={profileName} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.name || t('profilePage.customer.defaultName')}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.phone')}</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfilePhone(e.target.value)} type="tel" value={profilePhone} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.phone || '-'}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.location')}</p>
                {isEditing ? (
                  <input className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileLocation(e.target.value)} type="text" value={profileLocation} />
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{customerSession?.location || '-'}</p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs uppercase text-emerald-700">{t('profilePage.customer.language')}</p>
                {isEditing ? (
                  <select className="mt-1 w-full rounded-lg border border-emerald-100 bg-white px-2 py-1 text-sm" onChange={(e) => setProfileLanguage(e.target.value as 'en' | 'ml' | 'hi')} value={profileLanguage}>
                    <option value="en">{t('providerEditor.spoken.en')}</option>
                    <option value="ml">{t('providerEditor.spoken.ml')}</option>
                    <option value="hi">{t('providerEditor.spoken.hi')}</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-stone-800 uppercase">{profileLanguage}</p>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
              <p className="text-xs uppercase text-emerald-700">{t('profilePage.customer.notifications')}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-700">
                <label className="flex items-center gap-2">
                  <input checked={notifySms} disabled={!isEditing} onChange={(e) => setNotifySms(e.target.checked)} type="checkbox" />
                  {t('profilePage.customer.notifySms')}
                </label>
                <label className="flex items-center gap-2">
                  <input checked={notifyWhatsapp} disabled={!isEditing} onChange={(e) => setNotifyWhatsapp(e.target.checked)} type="checkbox" />
                  {t('profilePage.customer.notifyWhatsapp')}
                </label>
                <label className="flex items-center gap-2">
                  <input checked={notifyPush} disabled={!isEditing} onChange={(e) => setNotifyPush(e.target.checked)} type="checkbox" />
                  {t('profilePage.customer.notifyPush')}
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <a className="text-sm font-semibold text-emerald-800 underline" href="/search">
                {t('profilePage.customer.findProviders')}
              </a>
              {isEditing ? (
                <button className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70" disabled={savingProfile} onClick={handleSaveProfile} type="button">
                  {savingProfile ? t('providerEditor.saving') : t('providerEditor.saveChanges')}
                </button>
              ) : null}
            </div>
            {profileMessage ? <p className="mt-3 text-xs text-stone-600">{profileMessage}</p> : null}
          </section>
          )
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <section className="w-full rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm lg:w-2/3">
              {providerLoading ? <p className="text-sm text-stone-600">{t('profilePage.providerPublic.loading')}</p> : null}
              {providerError ? <p className="text-sm text-red-700">{providerError}</p> : null}
              {!providerLoading && !providerError && providerProfile ? (
                <>
                  <div className="mb-5 overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white">
                    <div className="h-28 w-full bg-emerald-100">
                      {providerProfile.bannerUrl ? <img alt={t('profilePage.providerPublic.bannerAlt')} className="h-full w-full object-cover" src={providerProfile.bannerUrl} /> : null}
                    </div>
                    <div className="p-4">
                    <div className="flex items-start gap-4">
                      {providerProfile.avatarUrl ? (
                        <img alt={t('profilePage.providerPublic.avatarAlt')} className="h-20 w-20 rounded-xl object-cover shadow-sm" src={providerProfile.avatarUrl} />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-emerald-100 text-xl font-black text-emerald-800 shadow-sm">
                          {providerProfile.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-4xl font-black leading-tight text-emerald-900">{providerProfile.name}</h2>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{t('profilePage.providerPublic.verified')}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-stone-700">{providerProfile.title}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-600">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            {Number(providerProfile.rating || 0).toFixed(1)} ({Number(providerProfile.ratingCount || 0)})
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {providerProfile.location || t('profilePage.providerPublic.defaultLocation')}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">history</span>
                            {t('profilePage.providerPublic.yearsExperience', { years: String(providerProfile.yearsExperience) })}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {customerSession?.uid ? (
                            <button
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isProviderSaved
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
                              } disabled:opacity-70`}
                              disabled={savingProvider}
                              onClick={toggleSaveProvider}
                              type="button"
                            >
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isProviderSaved ? "'FILL' 1" : "'FILL' 0" }}>
                                favorite
                              </span>
                              {isProviderSaved ? t('profilePage.providerPublic.saved') : t('profilePage.providerPublic.save')}
                            </button>
                          ) : null}
                          {providerProfile.languages?.map((code) => (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800" key={code}>
                              {providerLanguageOptions.find((x) => x.code === code)?.label ?? code.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 p-4">
                    <h3 className="text-sm font-bold text-emerald-900">{t('profilePage.providerPublic.about')}</h3>
                    <p className="mt-2 text-base font-semibold text-stone-900">{providerProfile.aboutShort || t('profilePage.providerPublic.aboutShortFallback')}</p>
                    <p className="mt-2 text-sm text-stone-700">{providerProfile.aboutLong || t('profilePage.providerPublic.aboutLongFallback')}</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-100 p-4">
                    <h3 className="text-sm font-bold text-emerald-900">{t('profilePage.providerPublic.skillsServices')}</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {providerServiceCards.map((service) => (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3" key={service.name}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-stone-900">{service.name}</p>
                            <p className="text-xs font-semibold text-emerald-700">
                              {t('profilePage.providerPublic.perHour', { amount: String(Number(service.charge || providerProfile.hourlyRateFrom || 0)) })}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-stone-600">{service.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-100 p-4">
                    <h3 className="text-sm font-bold text-emerald-900">{t('profilePage.providerPublic.workGallery')}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {providerGallery.slice(0, 6).map((url) => (
                        <img alt={t('providerEditor.galleryWorkAlt')} className="h-28 w-full rounded-lg object-cover" key={url} src={url} />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-100 p-4">
                    <h3 className="text-sm font-bold text-emerald-900">{t('profilePage.providerPublic.availability')}</h3>
                    <p className="mt-2 text-sm text-stone-700">{providerProfile.availabilityTags.join(' • ')}</p>
                  </div>
                </>
              ) : null}
            </section>

            <aside className="w-full rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm lg:w-1/3">
              <h2 className="text-2xl font-bold text-emerald-900">{t('profilePage.booking.title')}</h2>
              <p className="mt-1 text-sm text-stone-600">{t('profilePage.booking.subtitle')}</p>
              <div className="mt-5 space-y-3">
                {pendingPayment ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase text-amber-800">{t('profilePage.booking.pendingPayment')}</p>
                    <p className="mt-1 text-sm text-amber-900">
                      {t('profilePage.booking.bookingWaiting', { jobId: pendingPayment.jobId })}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={bookingLoading}
                        onClick={handleResumePayment}
                        type="button"
                      >
                        {t('profilePage.booking.resumePayment')}
                      </button>
                      <button
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                        onClick={clearPendingPayment}
                        type="button"
                      >
                        {t('profilePage.booking.clear')}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{t('profilePage.booking.serviceNeeded')}</p>
                  <input
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={t('profilePage.booking.servicePlaceholder')}
                    type="text"
                    value={serviceName}
                  />
                  {recommendedServices.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recommendedServices.map((service) => (
                        <button
                          className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                          key={service.name}
                          onClick={() => setServiceName(service.name)}
                          type="button"
                        >
                          {service.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-stone-700">
                  <p className="text-[11px] uppercase text-emerald-700">{t('profilePage.booking.estimatedCharge')}</p>
                  <p className="font-semibold text-emerald-900">{t('profilePage.booking.perHour', { amount: String(estimatedRate) })}</p>
                </div>
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
                <textarea
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-sm"
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder={t('profilePage.booking.notesPlaceholder')}
                  rows={2}
                  value={bookingNotes}
                />
                <p className="text-[11px] text-stone-500">{t('profilePage.booking.tip')}</p>
                <button
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 py-3 text-white disabled:opacity-70"
                  disabled={bookingLoading || !serviceName.trim() || !bookingDate || !bookingTime}
                  onClick={handleBookService}
                  type="button"
                >
                  {bookingLoading ? t('profilePage.booking.bookingInProgress') : t('profilePage.booking.bookAndPay')}
                </button>
                {bookingMessage ? <p className="text-xs text-stone-600">{bookingMessage}</p> : null}
                {paymentState ? (
                  <p className="text-sm text-emerald-700">
                    {t('profilePage.paymentStatus.label')} {paymentStatusLabel(paymentState)}
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

function ProfileSuspenseFallback() {
  const { t } = useLocale()
  return <div className="p-6 text-stone-600">{t('profilePage.suspenseLoading')}</div>
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSuspenseFallback />}>
      <ProfilePageContent />
    </Suspense>
  )
}
