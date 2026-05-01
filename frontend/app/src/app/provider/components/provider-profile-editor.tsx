'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../auth-provider'
import { setSession } from '../../../lib/auth-client'
import { useLocale } from '../../locale-provider'
import { LanguageSwitcher } from '../../language-switcher'

type ProviderOwnProfile = {
  name: string
  phone: string
  location: string
  languages: Array<'en' | 'ml' | 'hi'>
  avatarUrl: string
  bannerUrl: string
  services: string[]
  yearsExperience: number
  hourlyRateFrom: number
  title: string
  aboutTitle: string
  aboutDescription: string
  gallery: string[]
  serviceHighlights: Array<{ name: string; description: string; icon?: string; charge?: number }>
  availabilityDays: number[]
  isOnline: boolean
}

export default function ProviderProfileEditor() {
  const router = useRouter()
  const { providerSession, refresh } = useAuth()
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

  const [isEditing, setIsEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [message, setMessage] = useState('')
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

  useEffect(() => {
    const loadProviderOwnProfile = async () => {
      if (!providerSession?.uid || !providerSession?.token) return
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
            Array.isArray(json.data.languages) && json.data.languages.length > 0 ? json.data.languages : [json.data.language || 'en']
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
  }, [providerSession?.uid, providerSession?.token])

  const uploadSingleImageAsDataUrl = async (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })

  const handleProviderGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files).slice(0, 6)
    const dataUrls = await Promise.all(fileArray.map((file) => uploadSingleImageAsDataUrl(file)))
    setProviderOwn((p) => ({ ...p, gallery: [...p.gallery, ...dataUrls].slice(0, 12) }))
  }

  const handleSaveProviderProfile = async () => {
    if (!providerSession?.uid || !providerSession?.token) {
      router.push('/auth?role=provider')
      return
    }
    try {
      setSavingProfile(true)
      setMessage('')
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
          services: providerOwn.serviceHighlights.length > 0 ? providerOwn.serviceHighlights.map((x) => x.name).filter(Boolean) : providerOwn.services,
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
      refresh()
      setMessage(t('providerEditor.messages.providerUpdated'))
      setIsEditing(false)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('providerEditor.messages.failedSave'))
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100/90 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-[0_12px_32px_rgba(16,84,58,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-emerald-900">{t('providerEditor.title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          <button className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50" onClick={() => setIsEditing((v) => !v)} type="button">
            {isEditing ? t('providerEditor.cancel') : t('providerEditor.editProfile')}
          </button>
        </div>
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
                  id="provider-banner-upload-dashboard"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const dataUrl = await uploadSingleImageAsDataUrl(file)
                    setProviderOwn((p) => ({ ...p, bannerUrl: dataUrl }))
                  }}
                  type="file"
                />
                <label className="absolute right-3 top-3 cursor-pointer rounded-xl bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black/80" htmlFor="provider-banner-upload-dashboard">
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
                  id="provider-avatar-upload-dashboard"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const dataUrl = await uploadSingleImageAsDataUrl(file)
                    setProviderOwn((p) => ({ ...p, avatarUrl: dataUrl }))
                  }}
                  type="file"
                />
                <label className="inline-block cursor-pointer rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50" htmlFor="provider-avatar-upload-dashboard">
                  {t('providerEditor.changePhoto')}
                </label>
              </>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.name')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, name: e.target.value }))} type="text" value={providerOwn.name} /> : <p className="text-sm font-semibold text-stone-800">{providerOwn.name || t('providerEditor.defaultProviderName')}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.phone')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, phone: e.target.value }))} type="tel" value={providerOwn.phone} /> : <p className="text-sm font-semibold text-stone-800">{providerOwn.phone || '-'}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.location')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, location: e.target.value }))} type="text" value={providerOwn.location} /> : <p className="text-sm font-semibold text-stone-800">{providerOwn.location || '-'}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.languages')}</p>
          {isEditing ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {providerLanguageOptions.map((item) => {
                const selected = providerOwn.languages.includes(item.code)
                return (
                  <button className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${selected ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'}`} key={item.code} onClick={() => setProviderOwn((p) => ({ ...p, languages: p.languages.includes(item.code) ? (p.languages.length > 1 ? p.languages.filter((x) => x !== item.code) : p.languages) : [...p.languages, item.code] }))} type="button">
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-stone-800">
              {providerOwn.languages.length > 0
                ? providerOwn.languages.map((code) => providerLanguageOptions.find((x) => x.code === code)?.label || code.toUpperCase()).join(', ')
                : t('providerEditor.notSpecified')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.profileTitle')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, title: e.target.value }))} type="text" value={providerOwn.title} /> : <p className="text-sm font-semibold text-stone-800">{providerOwn.title || '-'}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.yearsExperience')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" min={0} onChange={(e) => setProviderOwn((p) => ({ ...p, yearsExperience: Number(e.target.value || 0) }))} type="number" value={providerOwn.yearsExperience} /> : <p className="text-sm font-semibold text-stone-800">{t('providerEditor.yearsUnit', { years: String(providerOwn.yearsExperience) })}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.aboutTitle')}</p>
          {isEditing ? <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, aboutTitle: e.target.value }))} placeholder={t('providerEditor.placeholders.aboutTitle')} type="text" value={providerOwn.aboutTitle} /> : <p className="text-sm text-stone-800">{providerOwn.aboutTitle || '-'}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.aboutDescription')}</p>
          {isEditing ? <textarea className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, aboutDescription: e.target.value }))} placeholder={t('providerEditor.placeholders.aboutDescription')} rows={4} value={providerOwn.aboutDescription} /> : <p className="text-sm text-stone-800 whitespace-pre-wrap">{providerOwn.aboutDescription || '-'}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.serviceCards')}</p>
          {isEditing ? (
            <div className="mt-2 space-y-3">
              <p className="text-xs text-stone-600">{t('providerEditor.serviceCardsHint')}</p>
              {providerOwn.serviceHighlights.length > 0 ? providerOwn.serviceHighlights.map((card, idx) => (
                <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm" key={`${card.name}-${idx}`}>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
                    <div className="md:col-span-2">
                      <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.serviceName')}</p>
                      <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, serviceHighlights: p.serviceHighlights.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))} placeholder={t('providerEditor.placeholders.serviceName')} type="text" value={card.name} />
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.description')}</p>
                      <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(e) => setProviderOwn((p) => ({ ...p, serviceHighlights: p.serviceHighlights.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) }))} placeholder={t('providerEditor.placeholders.serviceDescription')} type="text" value={card.description} />
                    </div>
                    <div className="md:col-span-1">
                      <p className="text-[10px] uppercase text-emerald-700">{t('providerEditor.labels.chargePerHr')}</p>
                      <input className="mt-1 w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" min={0} onChange={(e) => setProviderOwn((p) => ({ ...p, serviceHighlights: p.serviceHighlights.map((x, i) => i === idx ? { ...x, charge: Number(e.target.value || 0) } : x) }))} type="number" value={Number(card.charge || 0)} />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button className="w-full rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" onClick={() => setProviderOwn((p) => ({ ...p, serviceHighlights: p.serviceHighlights.filter((_, i) => i !== idx) }))} type="button">{t('providerEditor.remove')}</button>
                    </div>
                  </div>
                </div>
              )) : <p className="text-sm text-stone-600">{t('providerEditor.noServiceCards')}</p>}
              <button className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50" onClick={() => setProviderOwn((p) => ({ ...p, serviceHighlights: [...p.serviceHighlights, { name: '', description: '', charge: 0 }] }))} type="button">{t('providerEditor.addServiceCard')}</button>
            </div>
          ) : <p className="text-sm text-stone-800">{t('providerEditor.serviceCardsConfigured', { count: String(providerOwn.serviceHighlights.length) })}</p>}
        </div>
        <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm md:col-span-2">
          <p className="text-xs uppercase text-emerald-700">{t('providerEditor.labels.workGallery')}</p>
          {isEditing ? (
            <div className="mt-2 space-y-3">
              <input accept="image/*" className="w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" multiple onChange={(e) => void handleProviderGalleryUpload(e.target.files)} type="file" />
              {providerOwn.gallery.length > 0 ? <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{providerOwn.gallery.map((url, idx) => (
                <div className="relative" key={`${url.slice(0, 24)}-${idx}`}>
                  <img alt={t('providerEditor.galleryAlt')} className="h-20 w-full rounded-lg object-cover" src={url} />
                  <button className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white" onClick={() => setProviderOwn((p) => ({ ...p, gallery: p.gallery.filter((_, i) => i !== idx) }))} type="button">{t('providerEditor.remove')}</button>
                </div>
              ))}</div> : <p className="text-sm text-stone-600">{t('providerEditor.noGalleryImages')}</p>}
            </div>
          ) : <p className="text-sm text-stone-800">{t('providerEditor.galleryImageCount', { count: String(providerOwn.gallery.length) })}</p>}
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
                    <input className="h-4 w-4 rounded border-emerald-300 accent-emerald-600" checked={providerOwn.availabilityDays.includes(idx)} onChange={(e) => setProviderOwn((p) => ({ ...p, availabilityDays: e.target.checked ? Array.from(new Set([...p.availabilityDays, idx])) : p.availabilityDays.filter((d) => d !== idx) }))} type="checkbox" />
                    {dayLabel}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-800">
              {providerOwn.isOnline ? t('providerEditor.onlineNow') : t('providerEditor.offline')} •{' '}
              {providerOwn.availabilityDays.length > 0 ? providerOwn.availabilityDays.sort((a, b) => a - b).map((d) => dayLabels[d]).join(', ') : t('providerEditor.onRequest')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {isEditing ? (
          <button className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-emerald-800 hover:to-emerald-600 disabled:opacity-70" disabled={savingProfile} onClick={handleSaveProviderProfile} type="button">
            {savingProfile ? t('providerEditor.saving') : t('providerEditor.saveChanges')}
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-xs text-stone-600">{message}</p> : null}
    </section>
  )
}
