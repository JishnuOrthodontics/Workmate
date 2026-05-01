'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../auth-provider'
import { LanguageSwitcher } from '../../language-switcher'
import { useLocale } from '../../locale-provider'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

type Panel = 'overview' | 'customers' | 'providers' | 'bookings' | 'reports' | 'settings'

type AdminOverview = {
  kpis: {
    totalCustomers: number;
    totalProviders: number;
    totalBookings: number;
    completedBookings: number;
  };
  recentActivity: Array<{
    id: string;
    customerName: string;
    providerName: string;
    serviceName: string;
    status: string;
    scheduledAt?: string;
    createdAt?: string;
  }>;
}
type AdminFeedbackItem = {
  id: string;
  jobId: string;
  rating: number;
  feedback: string;
  customerName: string;
  providerName: string;
  createdAt?: string;
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'captured') return 'bg-emerald-100 text-emerald-900 border-emerald-200'
  if (s === 'cancelled') return 'bg-stone-100 text-stone-700 border-stone-200'
  if (s === 'requested' || s === 'pending') return 'bg-amber-50 text-amber-900 border-amber-200'
  return 'bg-white text-emerald-800 border-emerald-200'
}

export default function AdminDashboardPage() {
  const { t } = useLocale()
  const { ready, adminSession, logout } = useAuth()
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const [activePanel, setActivePanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [customers, setCustomers] = useState<Array<any>>([])
  const [providers, setProviders] = useState<Array<any>>([])
  const [bookings, setBookings] = useState<Array<any>>([])
  const [reports, setReports] = useState<Record<string, number> | null>(null)
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([])

  const openPanel = (panel: Panel) => {
    setActivePanel(panel)
    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  useEffect(() => {
    if (!ready) return
    if (!adminSession?.uid || !adminSession?.token) {
      router.replace('/auth/admin?next=/admin/dashboard')
    }
  }, [ready, adminSession?.uid, adminSession?.token, router])

  useEffect(() => {
    const run = async () => {
      if (!adminSession?.token) return
      setLoading(true)
      setError('')
      try {
        const headers = { Authorization: `Bearer ${adminSession.token}` }
        const [overviewRes, customersRes, providersRes, bookingsRes, reportsRes, feedbackRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/overview`, { headers }),
          fetch(`${API_BASE}/api/admin/customers?page=1&pageSize=20`, { headers }),
          fetch(`${API_BASE}/api/admin/providers?page=1&pageSize=20`, { headers }),
          fetch(`${API_BASE}/api/admin/bookings?page=1&pageSize=20`, { headers }),
          fetch(`${API_BASE}/api/admin/reports`, { headers }),
          fetch(`${API_BASE}/api/admin/feedback?page=1&pageSize=12`, { headers }),
        ])
        if (!overviewRes.ok || !customersRes.ok || !providersRes.ok || !bookingsRes.ok || !reportsRes.ok || !feedbackRes.ok) {
          throw new Error('One or more admin endpoints failed')
        }
        const [overviewJson, customersJson, providersJson, bookingsJson, reportsJson, feedbackJson] = await Promise.all([
          overviewRes.json(),
          customersRes.json(),
          providersRes.json(),
          bookingsRes.json(),
          reportsRes.json(),
          feedbackRes.json(),
        ])
        setOverview(overviewJson?.data || null)
        setCustomers(customersJson?.data?.items || [])
        setProviders(providersJson?.data?.items || [])
        setBookings(bookingsJson?.data?.items || [])
        setReports(reportsJson?.data || null)
        setFeedbackItems(feedbackJson?.data?.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : t('adminDashboard.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [adminSession?.token, t])

  const reportLabels = useMemo(
    () => ({
      totalJobs: t('adminDashboard.reports.totalJobs'),
      completedJobs: t('adminDashboard.reports.completedJobs'),
      cancelledJobs: t('adminDashboard.reports.cancelledJobs'),
      pendingPayments: t('adminDashboard.reports.pendingPayments'),
      totalCustomers: t('adminDashboard.reports.totalCustomers'),
      totalProviders: t('adminDashboard.reports.totalProviders'),
      completionRate: t('adminDashboard.reports.completionRate'),
      totalFeedback: t('adminDashboard.reports.totalFeedback'),
      avgCustomerRating: t('adminDashboard.reports.avgCustomerRating'),
    }),
    [t]
  )

  const panels = useMemo<Array<{ id: Panel; label: string; icon: string }>>(
    () => [
      { id: 'overview', label: t('adminDashboard.panels.overview'), icon: 'dashboard' },
      { id: 'customers', label: t('adminDashboard.panels.customers'), icon: 'group' },
      { id: 'providers', label: t('adminDashboard.panels.providers'), icon: 'engineering' },
      { id: 'bookings', label: t('adminDashboard.panels.bookings'), icon: 'event_note' },
      { id: 'reports', label: t('adminDashboard.panels.reports'), icon: 'analytics' },
      { id: 'settings', label: t('adminDashboard.panels.settings'), icon: 'settings' },
    ],
    [t]
  )

  const adminName = adminSession?.name?.trim() || 'Admin'

  if (!ready || !adminSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 flex items-center justify-center font-body-md">
        <div className="rounded-2xl border border-emerald-100 bg-white/90 px-8 py-6 shadow-[0_10px_24px_rgba(30,70,32,0.08)]">
          <p className="text-stone-600">{t('adminDashboard.loadingSession')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {/* Desktop sidebar — aligned with customer dashboard */}
      <aside className="hidden lg:flex flex-col h-screen sticky top-0 py-8 px-4 w-64 border-r border-emerald-100 shadow-lg bg-white/80 backdrop-blur-xl font-['Inter'] tracking-tight">
        <div className="mb-8 px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/80">{t('adminDashboard.brandTag')}</p>
          <h2 className="text-xl font-bold text-[#1E4620]">{t('adminDashboard.roleTitle')}</h2>
          <p className="font-caption text-caption text-stone-500 mt-1">{t('adminDashboard.tagline')}</p>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => openPanel(panel.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activePanel === panel.id
                  ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white font-semibold shadow-md'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: activePanel === panel.id ? "'FILL' 1" : "'FILL' 0" }}
              >
                {panel.icon}
              </span>
              {panel.label}
            </button>
          ))}
        </nav>
        <div className="px-4 mt-auto space-y-2 pt-4 border-t border-emerald-100/80">
          <a
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-emerald-800 py-2"
            href="/"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            {t('adminDashboard.backToSite')}
          </a>
          <button
            className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-emerald-50 transition-colors"
            type="button"
            onClick={() => {
              logout('admin')
              router.push('/auth/admin')
            }}
          >
            {t('adminDashboard.logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between p-4 sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-emerald-100/80">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{t('adminDashboard.roleTitle')}</p>
            <h1 className="font-h3 text-h3 text-primary">{t('adminDashboard.brandTag')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
              type="button"
              onClick={() => {
                logout('admin')
                router.push('/auth/admin')
              }}
            >
              {t('adminDashboard.logout')}
            </button>
          </div>
        </header>

        {/* Mobile tab strip */}
        <div className="lg:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-emerald-100/60 bg-white/60">
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => openPanel(panel.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activePanel === panel.id
                  ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-sm'
                  : 'bg-white border border-emerald-100 text-stone-700'
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pb-8" ref={contentRef}>
          <div className="max-w-screen-xl mx-auto p-4 md:p-8 space-y-8">
            <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-6 md:p-8 text-white shadow-[0_12px_40px_rgba(30,70,32,0.18)]">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-emerald-100/90 text-xs font-semibold uppercase tracking-widest">{t('adminDashboard.hero.controlCenter')}</p>
                  <h1 className="font-h1 text-h1 text-white mt-1 tracking-tight">{t('adminDashboard.hero.hello', { name: adminName })}</h1>
                  <p className="text-emerald-50/95 mt-2 max-w-xl text-sm md:text-base">
                    {t('adminDashboard.hero.body')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                    <span className="material-symbols-outlined text-sm text-emerald-200">shield_person</span>
                    {t('adminDashboard.hero.badgeAuth')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                    <span className="material-symbols-outlined text-sm text-emerald-200">database</span>
                    {t('adminDashboard.hero.badgeLive')}
                  </span>
                </div>
              </div>
            </section>

            {loading ? (
              <div className="rounded-2xl border border-emerald-100 bg-white/90 p-8 shadow-sm">
                <div className="flex items-center gap-3 text-stone-600">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                  <span>{t('adminDashboard.loadingData')}</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-red-800 shadow-sm">
                <p className="font-semibold">{t('adminDashboard.errorTitle')}</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            ) : null}

            {!loading && !error && activePanel === 'overview' && overview ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      label: t('adminDashboard.overview.kpiCustomers'),
                      value: overview.kpis.totalCustomers,
                      icon: 'group',
                      accent: 'from-teal-500/20 to-emerald-600/10',
                    },
                    {
                      label: t('adminDashboard.overview.kpiProviders'),
                      value: overview.kpis.totalProviders,
                      icon: 'handyman',
                      accent: 'from-emerald-500/20 to-teal-600/10',
                    },
                    {
                      label: t('adminDashboard.overview.kpiBookings'),
                      value: overview.kpis.totalBookings,
                      icon: 'calendar_month',
                      accent: 'from-emerald-600/15 to-emerald-400/10',
                    },
                    {
                      label: t('adminDashboard.overview.kpiCompleted'),
                      value: overview.kpis.completedBookings,
                      icon: 'task_alt',
                      accent: 'from-teal-600/20 to-emerald-500/10',
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/80 p-5 shadow-[0_10px_24px_rgba(30,70,32,0.06)]"
                    >
                      <div
                        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${kpi.accent} blur-2xl opacity-90`}
                      />
                      <div className="relative flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{kpi.label}</p>
                          <p className="mt-2 font-h2 text-h2 text-[#1E4620] tabular-nums">{kpi.value}</p>
                        </div>
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                          <span className="material-symbols-outlined">{kpi.icon}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-[0_10px_24px_rgba(30,70,32,0.06)] border border-emerald-100 p-5 md:p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-primary-container/5 rounded-bl-[80px] pointer-events-none -mr-4 -mt-4" />
                  <div className="relative z-10">
                    <h2 className="font-h3 text-h3 text-on-background mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-container">history</span>
                      {t('adminDashboard.overview.recentActivity')}
                    </h2>
                    {overview.recentActivity.length === 0 ? (
                      <p className="text-sm text-on-surface-variant">{t('adminDashboard.overview.noRecentBookings')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {overview.recentActivity.map((row) => (
                          <li
                            key={row.id}
                            className="rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-sm"
                          >
                            <div>
                              <p className="text-sm font-semibold text-on-background">
                                <span className="text-emerald-800">{row.customerName}</span>
                                <span className="text-on-surface-variant font-normal"> · {row.serviceName}</span>
                              </p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {t('adminDashboard.overview.withProvider', { provider: row.providerName })}
                              </p>
                            </div>
                            <span
                              className={`text-xs rounded-full border px-2.5 py-1 font-semibold capitalize ${statusBadgeClass(row.status)}`}
                            >
                              {row.status.replace('_', ' ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
                <section className="bg-white/90 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white">
                    <h2 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-700">feedback</span>
                      {t('adminDashboard.overview.feedbackTitle')}
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1">{t('adminDashboard.overview.feedbackSubtitle')}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {feedbackItems.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-on-surface-variant">No feedback submitted yet.</p>
                    ) : (
                      feedbackItems.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-on-background">
                              {item.customerName} → {item.providerName}
                            </p>
                            <span className="text-xs rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                              {item.rating}/5
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-600">{item.feedback || t('adminDashboard.overview.noComments')}</p>
                          <p className="mt-1 text-[11px] text-stone-400">{t('adminDashboard.overview.jobLine', { jobId: item.jobId })}{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {!loading && !error && activePanel === 'customers' ? (
              <section className="bg-white/90 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white">
                  <h2 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">group</span>
                    {t('adminDashboard.customers.title')}
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">{t('adminDashboard.customers.subtitle')}</p>
                </div>
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        <th className="px-4 py-3">{t('adminDashboard.customers.name')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.customers.phone')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.customers.location')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant">
                            {t('adminDashboard.customers.empty')}
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => (
                          <tr
                            key={c.id}
                            className="border-t border-emerald-50 hover:bg-emerald-50/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-on-background">{c.name || '—'}</td>
                            <td className="px-4 py-3 text-on-surface-variant tabular-nums">{c.phone}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{c.location || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {!loading && !error && activePanel === 'providers' ? (
              <section className="bg-white/90 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white">
                  <h2 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">engineering</span>
                    {t('adminDashboard.providers.title')}
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">{t('adminDashboard.providers.subtitle')}</p>
                </div>
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        <th className="px-4 py-3">{t('adminDashboard.providers.name')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.providers.phone')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.providers.skills')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.providers.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">
                            {t('adminDashboard.providers.empty')}
                          </td>
                        </tr>
                      ) : (
                        providers.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-emerald-50 hover:bg-emerald-50/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-on-background">{p.name || '—'}</td>
                            <td className="px-4 py-3 text-on-surface-variant tabular-nums">{p.phone}</td>
                            <td className="px-4 py-3 text-on-surface-variant">
                              {(p.skills || []).slice(0, 3).join(', ') || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs rounded-full border px-2.5 py-1 font-semibold ${
                                  p.isOnline
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : 'bg-stone-50 text-stone-600 border-stone-200'
                                }`}
                              >
                                {p.isOnline ? t('adminDashboard.providers.online') : t('adminDashboard.providers.offline')}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {!loading && !error && activePanel === 'bookings' ? (
              <section className="bg-white/90 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-white">
                  <h2 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">event_note</span>
                    {t('adminDashboard.bookings.title')}
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">{t('adminDashboard.bookings.subtitle')}</p>
                </div>
                <div className="overflow-x-auto p-2">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        <th className="px-4 py-3">{t('adminDashboard.bookings.service')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.bookings.customer')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.bookings.provider')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.bookings.status')}</th>
                        <th className="px-4 py-3">{t('adminDashboard.bookings.payment')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                            {t('adminDashboard.bookings.empty')}
                          </td>
                        </tr>
                      ) : (
                        bookings.map((b) => (
                          <tr
                            key={b.id}
                            className="border-t border-emerald-50 hover:bg-emerald-50/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-on-background">{b.serviceName}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{b.customerName}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{b.providerName}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs rounded-full border px-2.5 py-1 font-semibold capitalize ${statusBadgeClass(b.status)}`}
                              >
                                {String(b.status || '').replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-900 capitalize">
                                {String(b.paymentStatus || '').replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {!loading && !error && activePanel === 'reports' && reports ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(reports).map(([key, value]) => (
                  <div
                    key={key}
                    className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/90 p-5 shadow-[0_10px_24px_rgba(30,70,32,0.06)]"
                  >
                    <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-200/30 blur-xl pointer-events-none" />
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500 relative">
                      {reportLabels[key as keyof typeof reportLabels] || key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[#1E4620] tabular-nums relative">
                      {typeof value === 'number' && key === 'completionRate' ? `${value}%` : value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && !error && activePanel === 'settings' ? (
              <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 md:p-8 shadow-[0_10px_24px_rgba(30,70,32,0.06)]">
                <h2 className="font-h3 text-h3 text-on-background flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-emerald-700">settings</span>
                  {t('adminDashboard.settings.title')}
                </h2>
                <p className="text-sm text-on-surface-variant max-w-lg">
                  {t('adminDashboard.settings.intro', {
                    name: adminName,
                    phone: adminSession.phone ? ` · ${adminSession.phone}` : '',
                  })}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('adminDashboard.settings.apiBase')}</p>
                    <p className="mt-1 text-sm font-mono text-stone-800 break-all">{API_BASE}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('adminDashboard.settings.session')}</p>
                    <p className="mt-1 text-sm text-stone-700">{t('adminDashboard.settings.sessionValue')}</p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
