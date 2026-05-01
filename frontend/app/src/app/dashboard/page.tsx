'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../auth-provider'
import { LanguageSwitcher } from '../language-switcher'
import { useLocale } from '../locale-provider'

export default function WorkerDashboardPage() {
  const { t } = useLocale()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [bookings, setBookings] = useState<Array<{ id: string; status: string; paymentStatus: string; serviceName: string; providerName: string; scheduledAt: string }>>([])
  const [savedProviders, setSavedProviders] = useState<Array<{ id: string; name: string; title: string; location: string; avatarUrl: string }>>([])
  const [notifications, setNotifications] = useState<Array<{ _id: string; title: string; message: string; read: boolean; createdAt: string; type: string }>>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [filter, setFilter] = useState<'all' | 'requested' | 'active' | 'completed'>('all')
  const [payingJobId, setPayingJobId] = useState<string | null>(null)
  const [feedbackJobId, setFeedbackJobId] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const router = useRouter()
  const { ready, customerSession, logout } = useAuth()

  useEffect(() => {
    if (!ready) return
    if (!customerSession?.isAuthenticated || !customerSession?.token) {
      router.replace('/auth?role=customer')
      return
    }
    setIsAuthorized(true)
  }, [ready, customerSession, router])

  useEffect(() => {
    const run = async () => {
      if (!customerSession?.uid || !customerSession?.token) return
      const authHeaders = { Authorization: `Bearer ${customerSession.token}` }
      try {
        const [bookingsRes, notificationsRes, savedProvidersRes] = await Promise.all([
          fetch(`http://localhost:3333/api/bookings/customer/${customerSession.uid}`, { headers: authHeaders }),
          fetch(`http://localhost:3333/api/notifications/${customerSession.uid}?role=customer&limit=25`, { headers: authHeaders }),
          fetch(`http://localhost:3333/api/customers/${customerSession.uid}/saved-providers`, { headers: authHeaders }),
        ])
        const bookingsJson = await bookingsRes.json()
        const notificationsJson = await notificationsRes.json()
        const savedProvidersJson = await savedProvidersRes.json()
        if (bookingsRes.ok && bookingsJson?.success) setBookings(bookingsJson.data || [])
        if (notificationsRes.ok && notificationsJson?.success) {
          setNotifications(notificationsJson.data?.items || [])
          setUnreadCount(Number(notificationsJson.data?.unreadCount || 0))
        }
        if (savedProvidersRes.ok && savedProvidersJson?.success) {
          setSavedProviders(savedProvidersJson.data || [])
        }
      } catch {
        // keep dashboard usable even if booking API is unavailable
      }
    }
    run()
  }, [customerSession?.uid, customerSession?.token])

  const markNotificationRead = async (notificationId: string) => {
    try {
      if (!customerSession?.token) return
      const res = await fetch(`http://localhost:3333/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${customerSession.token}` },
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        pushLocalNotification(
          'Notification sync issue',
          json?.error || 'Unable to mark notification as read on server.',
          'system'
        )
        return
      }
      setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      pushLocalNotification(
        'Notification sync issue',
        'Network issue while updating notification read status.',
        'system'
      )
    }
  }

  const handleLogout = () => {
    logout('customer')
    router.push('/auth?role=customer')
  }

  const handleCancelBooking = async (jobId: string) => {
    try {
      if (!customerSession?.token) return
      const res = await fetch(`http://localhost:3333/api/bookings/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerSession.token}` },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        pushLocalNotification(
          'Cancellation failed',
          json?.error || `Unable to cancel booking ${jobId}.`,
          'booking'
        )
        return
      }
      setBookings((prev) => prev.map((b) => (b.id === jobId ? { ...b, status: 'cancelled' } : b)))
      pushLocalNotification(
        'Booking cancelled',
        `Booking ${jobId} was cancelled successfully.`,
        'booking'
      )
    } catch {
      pushLocalNotification(
        'Cancellation failed',
        `Network issue while cancelling booking ${jobId}.`,
        'booking'
      )
    }
  }

  const pushLocalNotification = (title: string, message: string, type: string = 'system') => {
    const localItem = {
      _id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      type,
    }
    setNotifications((prev) => [localItem, ...prev].slice(0, 50))
    setUnreadCount((prev) => prev + 1)
  }

  const handleResumePayment = async (jobId: string) => {
    try {
      if (!customerSession?.token || !customerSession?.uid) return
      setPayingJobId(jobId)
      const res = await fetch('http://localhost:3333/api/payments/phonepe/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerSession.token}`,
        },
        body: JSON.stringify({ jobId, idempotencyKey: customerSession.uid }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        pushLocalNotification(
          'Payment retry failed',
          json?.error || `Unable to resume payment for booking ${jobId}. Please try again.`,
          'payment'
        )
        return
      }
      const paymentUrl = json?.data?.paymentUrl as string | undefined
      if (paymentUrl) {
        window.open(paymentUrl, '_blank', 'noopener,noreferrer')
        pushLocalNotification(
          'Payment retry started',
          `Payment session reopened for booking ${jobId}. Complete it in PhonePe.`,
          'payment'
        )
      } else {
        pushLocalNotification(
          'Payment retry unavailable',
          `No payment link was returned for booking ${jobId}. Please retry shortly.`,
          'payment'
        )
      }
    } catch {
      pushLocalNotification(
        'Payment retry failed',
        `Network or server issue while reopening payment for booking ${jobId}.`,
        'payment'
      )
    } finally {
      setPayingJobId(null)
    }
  }

  const handleSubmitFeedback = async () => {
    try {
      if (!customerSession?.uid || !customerSession?.token || !feedbackJobId) {
        setFeedbackMessage(t('customerDashboard.feedback.msgSelectBooking'))
        return
      }
      if (!Number.isFinite(feedbackRating) || feedbackRating < 1 || feedbackRating > 5) {
        setFeedbackMessage(t('customerDashboard.feedback.msgRatingRange'))
        return
      }
      setFeedbackSubmitting(true)
      setFeedbackMessage('')

      const res = await fetch('http://localhost:3333/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerSession.token}`,
        },
        body: JSON.stringify({
          customerUid: customerSession.uid,
          jobId: feedbackJobId,
          rating: feedbackRating,
          feedback: feedbackText.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        setFeedbackMessage(json?.error || t('customerDashboard.feedback.msgSubmitFail'))
        return
      }
      setFeedbackText('')
      setFeedbackMessage(t('customerDashboard.feedback.msgThankYou'))
      pushLocalNotification('Feedback submitted', 'Your feedback has been shared with admin and provider.', 'system')
    } catch {
      setFeedbackMessage(t('customerDashboard.feedback.msgNetwork'))
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const visibleBookings = bookings.filter((booking) => {
    if (filter === 'all') return true
    if (filter === 'requested') return booking.status === 'requested'
    if (filter === 'active') return !['requested', 'completed', 'cancelled'].includes(booking.status)
    return ['completed', 'cancelled'].includes(booking.status)
  })
  const customerName = customerSession?.name?.trim() || 'Customer'
  const recentActivity = [...bookings]
    .filter((b) => ['completed', 'cancelled'].includes(b.status))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 4)
  const completedBookings = bookings.filter((b) => b.status === 'completed').slice(0, 20)

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {/* SideNavBar (Desktop) */}
      <aside className="hidden lg:flex flex-col h-screen sticky top-0 py-8 px-4 w-64 border-r border-emerald-100 shadow-lg bg-white/80 backdrop-blur-xl font-['Inter'] tracking-tight">
        <div className="mb-xl px-4">
          <h2 className="text-xl font-bold text-[#1E4620] dark:text-emerald-400">{t('customerDashboard.brand')}</h2>
          <p className="font-caption text-caption text-stone-500 mt-xs">{t('customerDashboard.tagline')}</p>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex flex-col gap-sm">
          <a className="flex items-center gap-3 text-stone-600 dark:text-stone-400 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" href="/search">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            {t('customerDashboard.nav.searchProviders')}
          </a>
          <a className="flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-emerald-500 text-white rounded-xl px-4 py-3 font-semibold shadow-md" href="/dashboard">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            {t('customerDashboard.nav.dashboard')}
          </a>
          <a className="flex items-center gap-3 text-stone-600 dark:text-stone-400 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" href="/profile">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>person</span>
            {t('customerDashboard.nav.account')}
          </a>
        </nav>
        <button className="mx-4 mt-4 rounded-xl bg-white border border-emerald-100 px-4 py-2 text-stone-700 hover:bg-emerald-50 transition-colors" onClick={handleLogout} type="button">
          {t('customerDashboard.nav.logout')}
        </button>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 overflow-y-auto pb-xl md:pb-0 relative">
        {/* Mobile Header (Minimal) */}
        <header className="lg:hidden flex items-center justify-between p-md sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-outline-variant/20">
          <h1 className="font-h3 text-h3 text-primary">{t('customerDashboard.brand')}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              className="px-3 py-2 rounded-lg border border-emerald-100 bg-white text-stone-700 text-xs font-semibold"
              onClick={handleLogout}
              type="button"
            >
              {t('customerDashboard.nav.logout')}
            </button>
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden">
              <span className="material-symbols-outlined text-outline">person</span>
            </div>
          </div>
        </header>

        <div className="max-w-screen-xl mx-auto p-md lg:p-xl space-y-xl">
          {/* Welcome Section */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-h1 text-h1 text-primary-container tracking-tight">{t('customerDashboard.welcome.title', { name: customerName })}</h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">{t('customerDashboard.welcome.subtitle')}</p>
              </div>
              <button
                className="relative rounded-xl border border-emerald-100 bg-white px-3 py-2 text-stone-700 hover:bg-emerald-50"
                onClick={() => setShowNotifications((v) => !v)}
                type="button"
              >
                <span className="material-symbols-outlined text-base">notifications</span>
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          </section>
          {showNotifications ? (
            <section className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-emerald-900">{t('customerDashboard.notifications.title')}</h2>
                <span className="text-xs text-stone-500">{t('customerDashboard.notifications.unread', { count: String(unreadCount) })}</span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-2 text-sm text-stone-500">{t('customerDashboard.notifications.empty')}</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      className={`w-full rounded-lg border p-3 text-left ${n.read ? 'border-stone-200 bg-white' : 'border-emerald-200 bg-emerald-50/50'}`}
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
            </section>
          ) : null}

          <section className="bg-white/90 rounded-2xl border border-emerald-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-h3 text-h3 text-on-surface">{t('customerDashboard.bookings.recentTitle')}</h2>
              <div className="flex items-center gap-1">
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'all' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('all')} type="button">{t('customerDashboard.bookings.filterAll')}</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'requested' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('requested')} type="button">{t('customerDashboard.bookings.filterRequested')}</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'active' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('active')} type="button">{t('customerDashboard.bookings.filterActive')}</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'completed' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('completed')} type="button">{t('customerDashboard.bookings.filterDone')}</button>
              </div>
            </div>
            {visibleBookings.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('customerDashboard.bookings.empty')}</p>
            ) : (
              <div className="space-y-2">
                {visibleBookings.slice(0, 6).map((booking) => (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2" key={booking.id}>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{booking.serviceName}</p>
                      <p className="text-xs text-on-surface-variant">{booking.providerName} • {new Date(booking.scheduledAt).toLocaleDateString()}</p>
                      <p className="text-[11px] text-emerald-700 capitalize">{t('customerDashboard.bookings.payment', { status: booking.paymentStatus.replace('_', ' ') })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs rounded-full bg-white border border-emerald-200 px-2 py-1 text-emerald-800 capitalize">{booking.status.replace('_', ' ')}</span>
                      {['requested', 'accepted'].includes(booking.status) ? (
                        <button className="text-xs rounded-md border border-stone-300 bg-white px-2 py-1 text-stone-700" onClick={() => handleCancelBooking(booking.id)} type="button">{t('customerDashboard.bookings.cancel')}</button>
                      ) : null}
                      {['pending', 'authorized'].includes(booking.paymentStatus) ? (
                        <button
                          className="text-xs rounded-md bg-amber-600 px-2 py-1 text-white disabled:opacity-60"
                          disabled={payingJobId === booking.id}
                          onClick={() => handleResumePayment(booking.id)}
                          type="button"
                        >
                          {payingJobId === booking.id ? t('customerDashboard.bookings.opening') : t('customerDashboard.bookings.resumePayment')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md lg:gap-lg">
            {/* Main Col (Span 2) */}
            <div className="lg:col-span-2 space-y-md lg:space-y-lg">
              {/* Active Bookings */}
              <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-[0_10px_24px_rgba(30,70,32,0.06)] border border-emerald-100 p-md relative overflow-hidden">
                {/* Subtle decorative background element mimicking traditional roof slope */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-bl-[100px] pointer-events-none -mr-8 -mt-8"></div>
                <div className="flex items-center justify-between mb-lg relative z-10">
                  <h2 className="font-h3 text-h3 text-on-background flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary-container">notifications_active</span>
                    {t('customerDashboard.activeBookings.title')}
                  </h2>
                  <button className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors">{t('customerDashboard.activeBookings.viewAll')}</button>
                </div>

                <div className="space-y-2 relative z-10">
                  {bookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).slice(0, 3).map((booking) => (
                    <div className="bg-surface-container-low rounded-lg p-md border border-outline-variant/20 flex items-center justify-between gap-3" key={booking.id}>
                      <div>
                        <h3 className="font-body-lg text-body-lg font-semibold text-on-background">{booking.serviceName}</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant">{booking.providerName} • {new Date(booking.scheduledAt).toLocaleString()}</p>
                      </div>
                      <span className="text-xs rounded-full bg-white border border-emerald-200 px-2 py-1 text-emerald-800 capitalize">{booking.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                  {bookings.filter((b) => !['completed', 'cancelled'].includes(b.status)).length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{t('customerDashboard.activeBookings.empty')}</p>
                  ) : null}
                </div>
              </section>

              {/* Recent Activity */}
              <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-[0_10px_24px_rgba(30,70,32,0.06)] border border-emerald-100 p-md">
                <h2 className="font-h3 text-h3 text-on-background mb-lg flex items-center gap-sm">
                  <span className="material-symbols-outlined text-outline">history</span>
                  {t('customerDashboard.recentActivity.title')}
                </h2>
                <div className="space-y-0">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{t('customerDashboard.recentActivity.empty')}</p>
                  ) : (
                    recentActivity.map((item) => (
                      <div className="flex items-start gap-md py-sm border-b border-outline-variant/20 last:border-0 last:pb-0" key={item.id}>
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mt-1">
                          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                            {item.status === 'completed' ? 'check_circle' : 'cancel'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-body-md text-body-md font-medium text-on-background">{item.serviceName}</h4>
                          <p className="font-caption text-caption text-on-surface-variant">
                            {item.status === 'completed' ? t('customerDashboard.recentActivity.completedWith', { provider: item.providerName }) : t('customerDashboard.recentActivity.cancelledWith', { provider: item.providerName })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-caption text-caption text-outline">{new Date(item.scheduledAt).toLocaleDateString()}</p>
                          <p className="font-caption text-caption text-primary font-medium mt-xs flex items-center justify-end gap-xs capitalize">
                            <span className="material-symbols-outlined text-[14px]">
                              {item.status === 'completed' ? 'check_circle' : 'cancel'}
                            </span>
                            {item.status}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Side Col (Span 1) */}
            <div className="lg:col-span-1">
              {/* Saved Providers */}
              <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-[0_10px_24px_rgba(30,70,32,0.06)] border border-emerald-100 p-md h-full">
                <div className="flex items-center justify-between mb-lg">
                  <h2 className="font-h3 text-h3 text-on-background flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary">favorite</span>
                    {t('customerDashboard.savedPros.title')}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-sm">
                  {savedProviders.length === 0 ? (
                    <div className="col-span-2 rounded-lg border border-outline-variant/20 bg-surface-container-low p-sm text-center text-xs text-on-surface-variant">
                      {t('customerDashboard.savedPros.empty')}
                    </div>
                  ) : (
                    savedProviders.slice(0, 4).map((provider) => (
                      <a className="bg-surface-container-low rounded-lg p-sm border border-outline-variant/20 flex flex-col items-center text-center hover:bg-surface-container transition-colors cursor-pointer group" href={`/profile?providerId=${provider.id}`} key={provider.id}>
                        <div className="mb-sm flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-surface-container-lowest bg-emerald-100 text-lg font-semibold text-emerald-800 shadow-sm">
                          {provider.avatarUrl ? <img alt={provider.name} className="h-full w-full object-cover" src={provider.avatarUrl} /> : provider.name.slice(0, 2).toUpperCase()}
                        </div>
                        <h4 className="font-label-md text-label-md text-on-background font-semibold line-clamp-1">{provider.name}</h4>
                        <p className="font-caption text-caption text-outline mt-xs line-clamp-1">{provider.location || provider.title}</p>
                      </a>
                    ))
                  )}

                  <a href="/search" className="bg-surface-container-low rounded-lg p-sm border border-outline-variant/20 flex flex-col items-center justify-center text-center hover:bg-surface-container transition-colors cursor-pointer group col-span-2">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-xs text-on-surface-variant group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">add</span>
                    </div>
                    <h4 className="font-label-md text-label-md text-on-background">{t('customerDashboard.savedPros.findMore')}</h4>
                  </a>
                </div>
              </section>
            </div>
          </div>

          <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700">rate_review</span>
                {t('customerDashboard.feedback.title')}
              </h2>
              <span className="text-xs text-stone-500">{t('customerDashboard.feedback.visibleToAdmin')}</span>
            </div>
            {completedBookings.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('customerDashboard.feedback.noCompleted')}</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('customerDashboard.feedback.bookingLabel')}</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-emerald-300"
                    onChange={(e) => setFeedbackJobId(e.target.value)}
                    value={feedbackJobId}
                  >
                    <option value="">{t('customerDashboard.feedback.selectBooking')}</option>
                    {completedBookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.serviceName} • {booking.providerName} • {new Date(booking.scheduledAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('customerDashboard.feedback.ratingLabel')}</label>
                  <div className="mt-1 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFeedbackRating(value)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold border ${
                          feedbackRating === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-700 border-emerald-200'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                    <span className="ml-1 text-xs text-stone-600">/ 5</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('customerDashboard.feedback.detailsLabel')}</label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-emerald-300"
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={t('customerDashboard.feedback.placeholder')}
                    rows={3}
                    value={feedbackText}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-stone-500">{t('customerDashboard.feedback.helper')}</p>
                  <button
                    className="rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={feedbackSubmitting || !feedbackJobId}
                    onClick={handleSubmitFeedback}
                    type="button"
                  >
                    {feedbackSubmitting ? t('customerDashboard.feedback.submitting') : t('customerDashboard.feedback.submit')}
                  </button>
                </div>
                {feedbackMessage ? <p className="text-xs text-stone-600">{feedbackMessage}</p> : null}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 md:hidden docked full-width bottom-0 rounded-t-2xl border-t border-[#5C4033]/10 dark:border-stone-800 shadow-[0_-4px_12px_rgba(30,70,32,0.05)] bg-[#fdfbf7]/90 dark:bg-stone-900/90 backdrop-blur-md">
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 rounded-xl px-3 py-1" href="/search">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('customerDashboard.mobileNav.providers')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-[#1E4620] dark:text-emerald-400 bg-[#e8f0e8] dark:bg-emerald-900/40 rounded-xl px-3 py-1" href="/dashboard">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('customerDashboard.mobileNav.dashboard')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 rounded-xl px-3 py-1" href="/profile">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>person</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('customerDashboard.mobileNav.account')}</span>
        </a>
      </nav>
    </div>
  )
}
