'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../auth-provider'

export default function ProviderDashboardPage() {
  const [isAuthorized, setIsAuthorized] = useState(false)
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

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {/* SideNavBar */}
      <aside className="hidden md:flex h-screen w-72 border-r border-emerald-100 flex-col gap-2 p-6 bg-white/80 backdrop-blur-xl shadow-[4px_0_24px_rgba(30,70,32,0.06)]">
        <div className="mb-8 px-4">
          <h1 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 tracking-tighter">Workmate</h1>
          <p className="font-caption text-caption text-on-surface-variant">Service Provider</p>
        </div>
        <nav className="flex flex-col gap-2 flex-1 font-['Inter'] text-sm font-medium tracking-tight">
          <a className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-700 to-emerald-500 text-white rounded-xl shadow-md active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out" href="/provider/dashboard">
            <span className="material-symbols-outlined">dashboard</span>
            Dashboard
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out" href="#bookings-queue">
            <span className="material-symbols-outlined">format_list_bulleted</span>
            Bookings Queue
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out" href="#payout-history">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            Earnings & Payouts
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50 rounded-lg active:scale-[0.98] transform-gpu transition-colors duration-200 ease-in-out" href="/profile">
            <span className="material-symbols-outlined">settings</span>
            Profile & Settings
          </a>
        </nav>
        <div className="mt-auto pt-4 border-t border-emerald-900/10">
          <button className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm shadow-primary/20 hover:bg-primary-container transition-colors disabled:opacity-70" disabled={updatingOnline} onClick={toggleOnline} type="button">{updatingOnline ? 'Updating...' : isOnline ? 'Go Offline' : 'Go Online'}</button>
          <button className="w-full mt-2 py-3 bg-surface border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors" onClick={handleLogout} type="button">Logout</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TopAppBar */}
        <header className="w-full sticky top-0 z-40 border-b border-emerald-100 shadow-sm bg-white/80 backdrop-blur-md flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <span className="md:hidden text-xl font-bold text-emerald-900 dark:text-emerald-100 font-['Inter']">Workmate</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="md:hidden px-3 py-2 rounded-lg border border-emerald-100 bg-white text-stone-700 text-xs font-semibold"
              onClick={handleLogout}
              type="button"
            >
              Logout
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
              <h4 className="text-sm font-bold text-emerald-900">Notifications</h4>
              <span className="text-xs text-stone-500">{unreadCount} unread</span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <p className="p-3 text-sm text-stone-500">No notifications yet.</p>
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
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-white p-2">
            <a className="rounded-lg bg-emerald-50 px-2 py-2 text-center text-xs font-semibold text-emerald-800" href="#bookings-queue">Queue</a>
            <a className="rounded-lg bg-emerald-50 px-2 py-2 text-center text-xs font-semibold text-emerald-800" href="#payout-history">Payouts</a>
            <a className="rounded-lg bg-emerald-50 px-2 py-2 text-center text-xs font-semibold text-emerald-800" href="/profile">Profile</a>
          </div>
        </div>

        {/* Dashboard Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-transparent">
          {/* Welcome Header */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="font-h2 text-h2 text-primary">Good Morning, Rajesh</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">Here is what your day looks like.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-surface-container rounded-full px-4 py-2 border border-outline-variant/30">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-tertiary-container' : 'bg-stone-300'}`}></span>
              <span className="font-label-md text-label-md text-on-surface">{isOnline ? 'Online & Ready' : 'Offline'}</span>
            </div>
          </div>

          <section className="bg-white/90 rounded-2xl border border-emerald-100 p-4 shadow-sm" id="bookings-queue">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-h3 text-h3 text-on-surface">Bookings Queue</h3>
              <div className="flex items-center gap-1">
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'all' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('all')} type="button">All</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'requested' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('requested')} type="button">Requested</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'active' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('active')} type="button">Active</button>
                <button className={`text-xs rounded-full px-2 py-1 border ${filter === 'completed' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-700 border-emerald-200'}`} onClick={() => setFilter('completed')} type="button">Done</button>
              </div>
            </div>
            {visibleBookings.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No booking requests yet.</p>
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
                        <button className="text-xs rounded-md bg-emerald-700 text-white px-2 py-1" onClick={() => handleStatusUpdate(booking.id, 'accepted')} type="button">Accept</button>
                        <button className="text-xs rounded-md border border-stone-300 text-stone-700 px-2 py-1" onClick={() => handleStatusUpdate(booking.id, 'cancelled')} type="button">Reject</button>
                      </div>
                    ) : null}
                    {['accepted', 'started', 'in_progress'].includes(booking.status) ? (
                      <div className="mt-2 flex gap-2">
                        {booking.status !== 'in_progress' && booking.status !== 'started' ? (
                          <button className="text-xs rounded-md bg-blue-700 text-white px-2 py-1 disabled:opacity-60" disabled={!['captured', 'released'].includes(booking.paymentStatus)} onClick={() => handleStatusUpdate(booking.id, 'in_progress')} type="button">Start</button>
                        ) : null}
                        <button className="text-xs rounded-md bg-emerald-700 text-white px-2 py-1 disabled:opacity-60" disabled={!['captured', 'released'].includes(booking.paymentStatus)} onClick={() => handleStatusUpdate(booking.id, 'completed')} type="button">Complete</button>
                      </div>
                    ) : null}
                    {!['captured', 'released'].includes(booking.paymentStatus) ? (
                      <p className="mt-2 text-[11px] text-amber-700">Waiting for customer payment capture before job progression.</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Performance Stats (Top Row, Span 12) */}
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card rounded-xl p-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-primary-container bg-primary-fixed p-2 rounded-lg">payments</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">Pending Payout</span>
                </div>
                <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.pendingPayoutAmount || 0)}</p>
                <p className="font-caption text-caption text-tertiary-container mt-1">Eligible for next weekly batch</p>
              </div>

              <div className="glass-card rounded-xl p-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-secondary-container bg-secondary-fixed p-2 rounded-lg">task_alt</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">This Week Gross</span>
                </div>
                <p className="font-h1 text-h1 text-on-surface">₹{Math.round(payoutSummary?.weekGrossAmount || 0)}</p>
                <p className="font-caption text-caption text-on-surface-variant mt-1">Before platform commission</p>
              </div>

              <div className="glass-card rounded-xl p-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-yellow-600 bg-yellow-100 p-2 rounded-lg">star</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">Last Payout</span>
                </div>
                <p className="font-h1 text-h1 text-on-surface capitalize">{payoutSummary?.lastPayoutStatus || 'none'}</p>
                <p className="font-caption text-caption text-on-surface-variant mt-1">₹{Math.round(payoutSummary?.lastPayoutAmount || 0)}</p>
              </div>
            </div>

            {/* Main Column (Span 8) */}
            <div className="lg:col-span-8 space-y-6">
              <section>
                <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">bolt</span>
                  New Requests
                </h3>
                <div className="space-y-3">
                  {visibleBookings.filter((b) => b.status === 'requested').map((booking) => (
                    <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl p-md border border-emerald-100 shadow-sm" key={booking.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-h3 text-h3 text-on-surface">{booking.serviceName}</h4>
                          <p className="font-body-md text-body-md text-on-surface-variant">{booking.customerName} • {new Date(booking.scheduledAt).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="bg-primary text-on-primary font-label-md px-3 py-2 rounded-lg" onClick={() => handleStatusUpdate(booking.id, 'accepted')} type="button">Accept</button>
                          <button className="border border-outline text-on-surface font-label-md px-3 py-2 rounded-lg" onClick={() => handleStatusUpdate(booking.id, 'cancelled')} type="button">Decline</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleBookings.filter((b) => b.status === 'requested').length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No new requests right now.</p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">construction</span>
                  Active Jobs
                </h3>
                <div className="space-y-3">
                  {visibleBookings.filter((b) => !['requested', 'cancelled', 'completed'].includes(b.status)).map((booking) => (
                    <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl p-md border border-emerald-100 shadow-sm" key={booking.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-h3 text-h3 text-on-surface">{booking.serviceName}</h4>
                          <p className="font-body-md text-body-md text-on-surface-variant">{booking.customerName} • {new Date(booking.scheduledAt).toLocaleString()}</p>
                        </div>
                        <span className="text-xs rounded-full bg-white border border-emerald-200 px-2 py-1 text-emerald-800 capitalize">{booking.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                  {visibleBookings.filter((b) => !['requested', 'cancelled', 'completed'].includes(b.status)).length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No active jobs currently.</p>
                  ) : null}
                </div>
              </section>
            </div>

            {/* Side Column (Span 4) */}
            <div className="lg:col-span-4 space-y-6">
              <section id="payout-history">
                <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  Payout History
                </h3>
                <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-2">
                  {payoutHistory.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No payouts generated yet.</p>
                  ) : (
                    payoutHistory.slice(0, 5).map((row) => (
                      <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2" key={`${row.batchId}-${row.createdAt}`}>
                        <p className="text-xs text-on-surface-variant">{new Date(row.createdAt).toLocaleDateString()} • {row.batchId}</p>
                        <p className="text-sm font-semibold text-on-surface">₹{Math.round(row.netAmount)}</p>
                        <p className="text-[11px] capitalize text-emerald-700">{row.status}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
              {/* Job Map Widget */}
              <section className="h-full">
                <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">map</span>
                  Today's Route
                </h3>
                <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden h-[400px] flex flex-col relative">
                  {/* Placeholder Map Image */}
                  <img alt="Map" className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-multiply" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5CWSe9h37P6LckWqMBSjHafjYMFLYPLWNQUBVxnIfGVSZfRFj3DAk6mmlfb56ypM-sriQGap2o1lbVODP-AaU6u2PY3XGXrMiQWPPOuCe62BVlw236a5_sTicV9M1UZ0pgxeC0838tCYM2mU3A4gUndF2piEQT-pRDeiX6TKtgz-tTqn1yda6WkijUQbI9CsNo06byusXlsEWejDT5nX8OGKaF2Z_UqyKzj_VigK2Qvq8Rs9yfFMACmNz-vQWh1Pu3YgZ0KJaiwSY" />
                  {/* Map Overlay Info */}
                  <div className="relative z-10 mt-auto p-4 bg-gradient-to-t from-surface via-surface/90 to-transparent">
                    <div className="glass-card rounded-lg p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                        <span className="material-symbols-outlined">near_me</span>
                      </div>
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">Next Stop: 4.2 km</p>
                        <p className="font-caption text-caption text-on-surface-variant">Est. 12 mins drive</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
