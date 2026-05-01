'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../auth-provider'
import { LanguageSwitcher } from '../../language-switcher'
import { useLocale } from '../../locale-provider'
import ProviderProfileEditor from '../components/provider-profile-editor'

export default function ProviderDashboardPage() {
  const { t } = useLocale()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [activePanel, setActivePanel] = useState<'dashboard' | 'bookings' | 'earnings' | 'profile'>('dashboard')
  const [incomingBookings, setIncomingBookings] = useState<Array<{ id: string; status: string; paymentStatus: string; serviceName: string; customerName: string; scheduledAt: string }>>([])
  const [payoutSummary, setPayoutSummary] = useState<{ pendingPayoutAmount: number; weekGrossAmount: number; lastPayoutStatus: string; lastPayoutAmount: number } | null>(null)
  const [payoutHistory, setPayoutHistory] = useState<Array<{ batchId: string; netAmount: number; status: string; createdAt: string }>>([])
  const [isOnline, setIsOnline] = useState(false)
  const [updatingOnline, setUpdatingOnline] = useState(false)
  const [notifications, setNotifications] = useState<Array<{ _id: string; title: string; message: string; read: boolean; createdAt: string; type: string }>>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [filter, setFilter] = useState<'all' | 'requested' | 'active' | 'completed'>('all')
  const router = useRouter()
  const { ready, providerSession, logout } = useAuth()

  useEffect(() => {
    if (!ready) return
    if (!providerSession?.isAuthenticated || !providerSession?.token) {
      router.replace('/auth?role=provider')
      return
    }
    setIsAuthorized(true)
  }, [ready, providerSession, router])

  useEffect(() => {
    const run = async () => {
      if (!providerSession?.uid || !providerSession?.token) return
      const authHeaders = { Authorization: `Bearer ${providerSession.token}` }
      try {
        const [bookingsRes, summaryRes, historyRes, notificationsRes] = await Promise.all([
          fetch(`http://localhost:3333/api/bookings/provider/${providerSession.uid}`, { headers: authHeaders }),
          fetch(`http://localhost:3333/api/payouts/provider/${providerSession.uid}/summary`, { headers: authHeaders }),
          fetch(`http://localhost:3333/api/payouts/provider/${providerSession.uid}`, { headers: authHeaders }),
          fetch(`http://localhost:3333/api/notifications/${providerSession.uid}?role=provider&limit=25`, { headers: authHeaders }),
        ])
        const bookingsJson = await bookingsRes.json()
        const summaryJson = await summaryRes.json()
        const historyJson = await historyRes.json()
        const notificationsJson = await notificationsRes.json()
        if (bookingsRes.ok && bookingsJson?.success) setIncomingBookings(bookingsJson.data || [])
        if (summaryRes.ok && summaryJson?.success) setPayoutSummary(summaryJson.data || null)
        if (historyRes.ok && historyJson?.success) setPayoutHistory(historyJson.data || [])
        if (notificationsRes.ok && notificationsJson?.success) {
          setNotifications(notificationsJson.data?.items || [])
          setUnreadCount(Number(notificationsJson.data?.unreadCount || 0))
        }
        const availabilityRes = await fetch(`http://localhost:3333/api/providers/${providerSession.uid}/availability`, { headers: authHeaders })
        const availabilityJson = await availabilityRes.json()
        if (availabilityRes.ok && availabilityJson?.success) setIsOnline(Boolean(availabilityJson.data?.isOnline))
      } catch {
        // keep dashboard usable even if booking API is unavailable
      }
    }
    run()
  }, [providerSession?.uid, providerSession?.token])

  const markNotificationRead = async (notificationId: string) => {
    try {
      if (!providerSession?.token) return
      const res = await fetch(`http://localhost:3333/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${providerSession.token}` },
      })
      const json = await res.json()
      if (!res.ok || !json?.success) return
      setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // ignore transient notification errors
    }
  }

  const handleStatusUpdate = async (jobId: string, status: 'accepted' | 'cancelled' | 'in_progress' | 'completed') => {
    try {
      if (!providerSession?.token) return
      await fetch(`http://localhost:3333/api/bookings/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerSession.token}` },
        body: JSON.stringify({ status }),
      })
      setIncomingBookings((prev) => prev.map((b) => (b.id === jobId ? { ...b, status } : b)))
    } catch {
      // no-op for now
    }
  }

  const visibleBookings = incomingBookings.filter((booking) => {
    if (filter === 'all') return true
    if (filter === 'requested') return booking.status === 'requested'
    if (filter === 'active') return ['accepted', 'started', 'in_progress'].includes(booking.status)
    return ['completed', 'cancelled'].includes(booking.status)
  })

  const handleLogout = () => {
    logout('provider')
    router.push('/auth?role=provider')
  }

  const toggleOnline = async () => {
    if (!providerSession?.uid) return
    try {
      setUpdatingOnline(true)
      const next = !isOnline
      if (!providerSession?.token) return
      const res = await fetch(`http://localhost:3333/api/providers/${providerSession.uid}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerSession.token}` },
        body: JSON.stringify({ isOnline: next }),
      })
      const json = await res.json()
      if (res.ok && json?.success) setIsOnline(Boolean(json.data?.isOnline))
    } catch {
      // keep UI stable
    } finally {
      setUpdatingOnline(false)
    }
  }

  const openPanel = (panel: 'dashboard' | 'bookings' | 'earnings' | 'profile') => {
    setActivePanel(panel)
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  if (!isAuthorized) {
    return null
  }

  const providerName = providerSession?.name?.trim() || 'Provider'

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {/* SideNavBar */}
      <aside className="hidden md:flex h-screen w-72 border-r border-emerald-100 flex-col gap-2 p-6 bg-white/80 backdrop-blur-xl shadow-[4px_0_24px_rgba(30,70,32,0.06)]">
        <div className="mb-8 px-4">
          <h1 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 tracking-tighter">{t('providerDashboard.brand')}</h1>
          <p className="font-caption text-caption text-on-surface-variant">{t('providerDashboard.tagline')}</p>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex flex-col gap-2 flex-1 font-['Inter'] text-sm font-medium tracking-tight">
          <button className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out ${activePanel === 'dashboard' ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-md' : 'text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50'}`} onClick={() => openPanel('dashboard')} type="button">
            <span className="material-symbols-outlined">dashboard</span>
            {t('providerDashboard.nav.dashboard')}
          </button>
          <button className={`flex items-center gap-3 px-4 py-3 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out text-left ${activePanel === 'bookings' ? 'bg-emerald-100 text-emerald-900' : 'text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50'}`} onClick={() => openPanel('bookings')} type="button">
            <span className="material-symbols-outlined">format_list_bulleted</span>
            {t('providerDashboard.nav.bookingsQueue')}
          </button>
          <button className={`flex items-center gap-3 px-4 py-3 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out text-left ${activePanel === 'earnings' ? 'bg-emerald-100 text-emerald-900' : 'text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50'}`} onClick={() => openPanel('earnings')} type="button">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            {t('providerDashboard.nav.earnings')}
          </button>
          <button className={`flex items-center gap-3 px-4 py-3 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out ${activePanel === 'profile' ? 'bg-emerald-100 text-emerald-900' : 'text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50'}`} onClick={() => openPanel('profile')} type="button">
            <span className="material-symbols-outlined">settings</span>
            {t('providerDashboard.nav.profile')}
          </button>
        </nav>
        <div className="mt-auto pt-4 border-t border-emerald-900/10">
          <button className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm shadow-primary/20 hover:bg-primary-container transition-colors disabled:opacity-70" disabled={updatingOnline} onClick={toggleOnline} type="button">{updatingOnline ? t('providerDashboard.online.updating') : isOnline ? t('providerDashboard.online.goOffline') : t('providerDashboard.online.goOnline')}</button>
          <button className="w-full mt-2 py-3 bg-surface border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors" onClick={handleLogout} type="button">{t('providerDashboard.logout')}</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TopAppBar */}
        <header className="w-full sticky top-0 z-40 border-b border-emerald-100 shadow-sm bg-white/80 backdrop-blur-md flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <span className="md:hidden text-xl font-bold text-emerald-900 dark:text-emerald-100 font-['Inter']">{t('providerDashboard.brand')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
            <button
              className="md:hidden px-3 py-2 rounded-lg border border-emerald-100 bg-white text-stone-700 text-xs font-semibold"
              onClick={handleLogout}
              type="button"
            >
              {t('providerDashboard.logout')}
            </button>
            <button className="hidden md:inline-flex relative text-stone-500 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2 rounded-full transition-all focus:ring-2 focus:ring-emerald-500/20 outline-none" onClick={() => setShowNotifications((v) => !v)} type="button">
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
            <button className="hidden md:inline-flex text-stone-500 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2 rounded-full transition-all focus:ring-2 focus:ring-emerald-500/20 outline-none">
              <span className="material-symbols-outlined">chat_bubble</span>
            </button>
            <button className="hidden md:inline-flex text-stone-500 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2 rounded-full transition-all focus:ring-2 focus:ring-emerald-500/20 outline-none">
              <img alt="Provider Avatar" className="w-8 h-8 rounded-full object-cover border border-outline-variant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBROOxUhB7XAwExb1ERED4ELIglvZONgRrOonEfGuxtOMoJ5zmenZnInvVL4rilv0Q-N4dEvyiUSfuPDMP_DsmbdaW2_C3JVro2gSjsQED1BXWqsL8YqmlYJSv__mbiJCiHmiHq-f0rgDl-8ggOD95_bspRfCaSG7s3nTR39SxD7i6Lu2ELJRDwWOD1sB4Sc6ucFqzaYi7MF9bb_Mblt3ZZm_XHCCxjba0IyXTlIicJtBGHM_GRd1TGgnwoVA9yGkESwHwie83-Be1M" />
            </button>
          </div>
        </header>
        {showNotifications ? (
          <div className="hidden md:block absolute right-6 top-20 z-50 w-96 rounded-2xl border border-emerald-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
              <h4 className="text-sm font-bold text-emerald-900">{t('providerDashboard.notifications.title')}</h4>
              <span className="text-xs text-stone-500">{t('providerDashboard.notifications.unread', { count: String(unreadCount) })}</span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <p className="p-3 text-sm text-stone-500">{t('providerDashboard.notifications.empty')}</p>
              ) : (
                notifications.map((n) => (
                  <button
                    className={`mb-2 w-full rounded-lg border p-3 text-left ${n.read ? 'border-stone-200 bg-white' : 'border-emerald-200 bg-emerald-50/50'}`}
                    key={n._id}
                    onClick={() => markNotificationRead(n._id)}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-stone-900">{n.title}</p>
                    <p className="text-xs text-stone-600">{n.message}</p>
                    <p className="mt-1 text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
        <div className="md:hidden px-4 pt-3">
          <div className="grid grid-cols-4 gap-2 rounded-xl border border-emerald-100 bg-white p-2">
            <button className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${activePanel === 'dashboard' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'}`} onClick={() => openPanel('dashboard')} type="button">{t('providerDashboard.mobileTabs.home')}</button>
            <button className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${activePanel === 'bookings' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'}`} onClick={() => openPanel('bookings')} type="button">{t('providerDashboard.mobileTabs.queue')}</button>
            <button className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${activePanel === 'earnings' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'}`} onClick={() => openPanel('earnings')} type="button">{t('providerDashboard.mobileTabs.payouts')}</button>
            <button className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${activePanel === 'profile' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'}`} onClick={() => openPanel('profile')} type="button">{t('providerDashboard.mobileTabs.profile')}</button>
          </div>
        </div>

        {/* Dashboard Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-transparent" ref={contentRef}>
          {activePanel === 'profile' ? <ProviderProfileEditor /> : null}

          {activePanel === 'dashboard' ? (
            <>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="font-h2 text-h2 text-primary">{t('providerDashboard.home.greeting', { name: providerName })}</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('providerDashboard.home.daySubtitle')}</p>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-surface-container rounded-full px-4 py-2 border border-outline-variant/30">
                  <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-tertiary-container' : 'bg-stone-300'}`}></span>
                  <span className="font-label-md text-label-md text-on-surface">{isOnline ? t('providerDashboard.home.onlineReady') : t('providerDashboard.home.offline')}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-primary-container bg-primary-fixed p-2 rounded-lg">payments</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.home.pendingPayout')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.pendingPayoutAmount || 0)}</p>
                  <p className="font-caption text-caption text-tertiary-container mt-1">{t('providerDashboard.home.pendingPayoutCaption')}</p>
                </div>
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-secondary-container bg-secondary-fixed p-2 rounded-lg">task_alt</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.home.weekGross')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.weekGrossAmount || 0)}</p>
                  <p className="font-caption text-caption text-on-surface-variant mt-1">{t('providerDashboard.home.weekGrossCaption')}</p>
                </div>
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-yellow-600 bg-yellow-100 p-2 rounded-lg">star</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.home.lastPayout')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface capitalize">{payoutSummary?.lastPayoutStatus || t('providerDashboard.home.none')}</p>
                  <p className="font-caption text-caption text-on-surface-variant mt-1">₹{Math.round(payoutSummary?.lastPayoutAmount || 0)}</p>
                </div>
              </div>
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <h3 className="font-h3 text-h3 text-primary mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">format_list_bulleted</span>
                    {t('providerDashboard.home.quickQueueTitle')}
                  </h3>
                  {visibleBookings.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{t('providerDashboard.home.noBookings')}</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleBookings.slice(0, 3).map((booking) => (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2" key={booking.id}>
                          <p className="text-sm font-semibold text-on-surface">{booking.serviceName}</p>
                          <p className="text-xs text-on-surface-variant">{booking.customerName}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <section>
                  <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">map</span>
                    {t('providerDashboard.home.routeTitle')}
                  </h3>
                  <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden h-[360px] flex flex-col relative">
                    <img alt="Map" className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-multiply" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5CWSe9h37P6LckWqMBSjHafjYMFLYPLWNQUBVxnIfGVSZfRFj3DAk6mmlfb56ypM-sriQGap2o1lbVODP-AaU6u2PY3XGXrMiQWPPOuCe62BVlw236a5_sTicV9M1UZ0pgxeC0838tCYM2mU3A4gUndF2piEQT-pRDeiX6TKtgz-tTqn1yda6WkijUQbI9CsNo06byusXlsEWejDT5nX8OGKaF2Z_UqyKzj_VigK2Qvq8Rs9yfFMACmNz-vQWh1Pu3YgZ0KJaiwSY" />
                    <div className="relative z-10 mt-auto p-4 bg-gradient-to-t from-surface via-surface/90 to-transparent">
                      <div className="glass-card rounded-lg p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                          <span className="material-symbols-outlined">near_me</span>
                        </div>
                        <div>
                          <p className="font-label-md text-label-md text-on-surface">{t('providerDashboard.home.nextStop')}</p>
                          <p className="font-caption text-caption text-on-surface-variant">{t('providerDashboard.home.estDrive')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            </>
          ) : null}

          {activePanel === 'bookings' ? (
            <>
              <h2 className="font-h2 text-h2 text-primary">{t('providerDashboard.queue.title')}</h2>
              <section className="bg-white/90 rounded-2xl border border-emerald-100 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-h3 text-h3 text-on-surface">{t('providerDashboard.queue.sectionTitle')}</h3>
                  <div className="flex items-center gap-1">
                    <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'all' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('all')} type="button">{t('providerDashboard.queue.filterAll')}</button>
                    <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'requested' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('requested')} type="button">{t('providerDashboard.queue.filterRequested')}</button>
                    <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'active' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('active')} type="button">{t('providerDashboard.queue.filterActive')}</button>
                    <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'completed' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('completed')} type="button">{t('providerDashboard.queue.filterDone')}</button>
                  </div>
                </div>
                {visibleBookings.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">{t('providerDashboard.queue.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {visibleBookings.slice(0, 8).map((booking) => (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2" key={booking.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-on-surface">{booking.serviceName}</p>
                            <p className="text-xs text-on-surface-variant">{booking.customerName} • {new Date(booking.scheduledAt).toLocaleDateString()}</p>
                          </div>
                          <span className="text-xs rounded-full bg-white border border-emerald-200 px-2 py-1 text-emerald-800 capitalize">{booking.status.replace('_', ' ')}</span>
                        </div>
                        {booking.status === 'requested' ? (
                          <div className="mt-2 flex gap-2">
                            <button className="text-xs rounded-md bg-emerald-700 text-white px-2 py-1" onClick={() => handleStatusUpdate(booking.id, 'accepted')} type="button">{t('providerDashboard.queue.accept')}</button>
                            <button className="text-xs rounded-md border border-stone-300 text-stone-700 px-2 py-1" onClick={() => handleStatusUpdate(booking.id, 'cancelled')} type="button">{t('providerDashboard.queue.reject')}</button>
                          </div>
                        ) : null}
                        {['accepted', 'started', 'in_progress'].includes(booking.status) ? (
                          <div className="mt-2 flex gap-2">
                            {booking.status !== 'in_progress' && booking.status !== 'started' ? (
                              <button className="text-xs rounded-md bg-blue-700 text-white px-2 py-1 disabled:opacity-60" disabled={!['captured', 'released'].includes(booking.paymentStatus)} onClick={() => handleStatusUpdate(booking.id, 'in_progress')} type="button">{t('providerDashboard.queue.start')}</button>
                            ) : null}
                            <button className="text-xs rounded-md bg-emerald-700 text-white px-2 py-1 disabled:opacity-60" disabled={!['captured', 'released'].includes(booking.paymentStatus)} onClick={() => handleStatusUpdate(booking.id, 'completed')} type="button">{t('providerDashboard.queue.complete')}</button>
                          </div>
                        ) : null}
                        {!['captured', 'released'].includes(booking.paymentStatus) ? (
                          <p className="mt-2 text-[11px] text-amber-700">{t('providerDashboard.queue.waitingPayment')}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {activePanel === 'earnings' ? (
            <>
              <h2 className="font-h2 text-h2 text-primary">{t('providerDashboard.earnings.title')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-primary-container bg-primary-fixed p-2 rounded-lg">payments</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.earnings.pendingPayout')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.pendingPayoutAmount || 0)}</p>
                </div>
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-secondary-container bg-secondary-fixed p-2 rounded-lg">task_alt</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.earnings.weekGross')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.weekGrossAmount || 0)}</p>
                </div>
                <div className="glass-card rounded-xl p-md">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-yellow-600 bg-yellow-100 p-2 rounded-lg">star</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('providerDashboard.earnings.lastPayout')}</span>
                  </div>
                  <p className="font-h1 text-h1 text-on-surface capitalize">{payoutSummary?.lastPayoutStatus || t('providerDashboard.earnings.none')}</p>
                </div>
              </div>
              <section>
                <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  {t('providerDashboard.earnings.historyTitle')}
                </h3>
                <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-2">
                  {payoutHistory.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{t('providerDashboard.earnings.noPayouts')}</p>
                  ) : (
                    payoutHistory.slice(0, 8).map((row) => (
                      <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2" key={`${row.batchId}-${row.createdAt}`}>
                        <p className="text-xs text-on-surface-variant">{new Date(row.createdAt).toLocaleDateString()} • {row.batchId}</p>
                        <p className="text-sm font-semibold text-on-surface">₹{Math.round(row.netAmount)}</p>
                        <p className="text-[11px] capitalize text-emerald-700">{row.status}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
