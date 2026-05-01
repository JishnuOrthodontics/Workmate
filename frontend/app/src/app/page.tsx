'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'
import { LanguageSwitcher } from './language-switcher'
import { useLocale } from './locale-provider'

export default function Home() {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { ready, activeRole } = useAuth()
  const { t } = useLocale()
  const dashboardHref = ready
    ? activeRole === 'admin'
      ? '/admin/dashboard'
      : activeRole === 'provider'
      ? '/provider/dashboard'
      : activeRole === 'customer'
      ? '/dashboard'
      : '/auth'
    : '/auth'

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/search')
    }
  }

  return (
    <>
      {/* TopNavBar */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-emerald-900/10 shadow-sm docked full-width top-0 z-50 sticky">
        <div className="flex justify-between items-center h-16 w-full px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-black tracking-tight text-emerald-900">Workmate</div>
            <nav className="hidden md:flex gap-6">
              <a className="text-emerald-900 border-b-2 border-emerald-900 pb-1 font-semibold hover:text-emerald-700 transition-colors font-h3 text-h3" href="/" style={{ fontSize: '16px', lineHeight: '24px' }}>{t('nav.home')}</a>
              <a className="text-stone-600 font-medium hover:text-emerald-700 transition-colors font-body-md text-body-md" href="/search">{t('nav.searchProviders')}</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <a className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-emerald-200 transition-all font-label-md text-label-md" href={dashboardHref}>{ready && activeRole ? t('nav.dashboard') : t('nav.login')}</a>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 text-white">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-teal-200/20 blur-3xl"></div>
          <div className="relative max-w-screen-xl mx-auto px-6 py-20 md:py-28 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 z-10">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
                {t('home.hero.badge')}
              </span>
              <h1 className="font-h1 text-h1 text-white">{t('home.hero.title')}</h1>
              <p className="font-body-lg text-body-lg text-emerald-50 max-w-xl">
                {t('home.hero.subtitle')}
              </p>
              <form onSubmit={handleSearch} className="mt-8 relative max-w-2xl bg-white p-2 rounded-2xl shadow-2xl flex items-center border border-white/70">
                <span className="material-symbols-outlined text-stone-500 ml-3">search</span>
                <input 
                  className="w-full bg-transparent border-none focus:ring-0 text-stone-800 font-body-md text-body-md px-4 placeholder-stone-400" 
                  placeholder={t('home.hero.searchPlaceholder')} 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-6 py-3 rounded-xl font-label-md text-label-md shadow-lg whitespace-nowrap hover:opacity-95">{t('home.hero.findHelp')}</button>
              </form>
              <div className="flex flex-wrap gap-3">
                <a className="bg-white/10 border border-white/30 text-white px-5 py-2 rounded-xl font-label-md hover:bg-white/20 transition-colors" href="/search">
                  {t('home.hero.searchProviders')}
                </a>
                <a className="bg-white text-emerald-700 px-5 py-2 rounded-xl font-label-md hover:bg-emerald-50 transition-colors" href={dashboardHref}>
                  {ready && activeRole ? t('home.hero.goToDashboard') : t('home.hero.loginToContinue')}
                </a>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">{t('home.hero.pillVerified')}</span>
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">{t('home.hero.pillPricing')}</span>
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">{t('home.hero.pillFast')}</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <img alt="Beautiful traditional Kerala style home with lush green surroundings and sloping roof" className="w-full h-[400px] object-cover rounded-3xl shadow-2xl border border-white/20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkYF1IlyJvUaEahzBluPtjPEoUlHd0YkoC5joue80UUkDJz8u1RYgCVWgOp9fhgyL6WLkrC2D2W86nB6Hq-5DmTWJTJzevUPAHjw0zEBz0tYggViytpfntTmbcDI3e9FrRc-bawqUQ1BWNYE-rNvPFzo61n9DpWTEp-q5skbJA1dKqvz3Tvg0Q3KGWk6SGyoZnEzsECEiuj5Gw78ERLMQEAmpB6-FhB1j1qummWXomaoXdEZ_7a-Qw5Qan-S_79i7KDmvNPqhCpZmd" />
              <div className="absolute -bottom-6 -left-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl flex items-center gap-4 border border-white/70">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{t('home.hero.cardTitle')}</p>
                  <p className="font-caption text-caption text-on-surface-variant">{t('home.hero.cardSubtitle')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem -> Solution */}
        <section className="py-16 bg-gradient-to-b from-white to-emerald-50/40">
          <div className="max-w-screen-xl mx-auto px-6 grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">{t('home.problem.card1Title')}</h3>
              <p className="text-on-surface-variant">{t('home.problem.card1Body')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">{t('home.problem.card2Title')}</h3>
              <p className="text-on-surface-variant">{t('home.problem.card2Body')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">{t('home.problem.card3Title')}</h3>
              <p className="text-on-surface-variant">{t('home.problem.card3Body')}</p>
            </div>
          </div>
        </section>

        {/* Service Discovery */}
        <section className="py-20 bg-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="font-h2 text-h2 text-on-surface mb-3">{t('home.discovery.title')}</h2>
              <p className="text-on-surface-variant">{t('home.discovery.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=electrical">
                <p className="font-label-md text-label-md text-primary-container mb-1">{t('home.discovery.electrical')}</p>
                <p className="text-on-surface-variant text-sm mb-3">{t('home.discovery.electricalMeta')}</p>
                <span className="text-primary font-medium">{t('home.discovery.electricalCta')}</span>
              </a>
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=plumbing">
                <p className="font-label-md text-label-md text-primary-container mb-1">{t('home.discovery.plumbing')}</p>
                <p className="text-on-surface-variant text-sm mb-3">{t('home.discovery.plumbingMeta')}</p>
                <span className="text-primary font-medium">{t('home.discovery.plumbingCta')}</span>
              </a>
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=cleaning">
                <p className="font-label-md text-label-md text-primary-container mb-1">{t('home.discovery.cleaning')}</p>
                <p className="text-on-surface-variant text-sm mb-3">{t('home.discovery.cleaningMeta')}</p>
                <span className="text-primary font-medium">{t('home.discovery.cleaningCta')}</span>
              </a>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="font-h2 text-h2 text-on-surface text-center mb-10">{t('home.how.title')}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">{t('home.how.step1Title')}</p>
                <p className="text-on-surface-variant">{t('home.how.step1Body')}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">{t('home.how.step2Title')}</p>
                <p className="text-on-surface-variant">{t('home.how.step2Body')}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">{t('home.how.step3Title')}</p>
                <p className="text-on-surface-variant">{t('home.how.step3Body')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust + Metrics */}
        <section className="py-16 bg-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-2xl border border-emerald-100 p-6 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">{t('home.trust.trustTitle')}</h3>
                <ul className="space-y-2 text-on-surface-variant">
                  <li>{t('home.trust.trustLi1')}</li>
                  <li>{t('home.trust.trustLi2')}</li>
                  <li>{t('home.trust.trustLi3')}</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">{t('home.trust.whyTitle')}</h3>
                <p className="text-on-surface-variant">{t('home.trust.whyBody')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">12k+</p>
                <p className="text-sm text-on-surface-variant">{t('home.metrics.jobs')}</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">4.8/5</p>
                <p className="text-sm text-on-surface-variant">{t('home.metrics.rating')}</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">3k+</p>
                <p className="text-sm text-on-surface-variant">{t('home.metrics.providers')}</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">70%</p>
                <p className="text-sm text-on-surface-variant">{t('home.metrics.repeat')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-16 bg-gradient-to-b from-white to-emerald-50/40">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="font-h2 text-h2 text-on-surface text-center mb-8">{t('home.testimonials.title')}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">{t('home.testimonials.q1')}</p>
                <p className="text-sm text-on-surface-variant">{t('home.testimonials.a1')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">{t('home.testimonials.q2')}</p>
                <p className="text-sm text-on-surface-variant">{t('home.testimonials.a2')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">{t('home.testimonials.q3')}</p>
                <p className="text-sm text-on-surface-variant">{t('home.testimonials.a3')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 text-white">
          <div className="max-w-screen-xl mx-auto px-6 text-center">
            <h2 className="font-h2 text-h2 mb-3">{t('home.cta.title')}</h2>
            <p className="text-emerald-50 mb-6">{t('home.cta.subtitle')}</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <a className="bg-white text-emerald-700 px-5 py-2 rounded-xl font-label-md hover:bg-emerald-50 transition-colors" href="/search">
                {t('home.cta.startSearching')}
              </a>
              <a className="bg-white/10 border border-white/30 px-5 py-2 rounded-xl font-label-md hover:bg-white/20 transition-colors" href={dashboardHref}>
                {ready && activeRole ? t('home.cta.openDashboard') : t('home.cta.loginRegister')}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#fdfbf7] dark:bg-stone-950 full-width border-t-2 border-[#5C4033] w-full py-12 px-6 md:px-12 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] mt-auto border-t border-[#5C4033]/20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-lg font-black text-[#1E4620] dark:text-emerald-400">Workmate</div>
          <nav className="flex flex-wrap justify-center gap-6">
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">{t('home.footer.about')}</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">{t('home.footer.contact')}</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">{t('home.footer.privacy')}</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">{t('home.footer.terms')}</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">{t('home.footer.partners')}</a>
          </nav>
          <div className="flex flex-col items-center md:items-end gap-2 text-center md:text-right">
            <div className="text-stone-600 dark:text-stone-400 font-['Inter'] text-sm">
              {t('home.footer.copyright')}
            </div>
            <a
              className="text-[11px] text-stone-400 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-500 font-['Inter'] transition-colors"
              href="/auth/admin"
            >
              {t('home.footer.staffSignIn')}
            </a>
          </div>
        </div>
      </footer>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="bg-[#fdfbf7]/90 dark:bg-stone-900/90 backdrop-blur-md docked full-width bottom-0 rounded-t-2xl border-t border-t border-[#5C4033]/10 dark:border-stone-800 shadow-[0_-4px_12px_rgba(30,70,32,0.05)] fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 md:hidden">
        <a className="flex flex-col items-center justify-center text-[#1E4620] dark:text-emerald-400 bg-[#e8f0e8] dark:bg-emerald-900/40 rounded-xl px-3 py-1 active:bg-stone-100 dark:active:bg-stone-800 scale-95 transition-transform duration-200" href="/">
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('home.mobileNav.home')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/search">
          <span className="material-symbols-outlined text-xl">search</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('home.mobileNav.search')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/search">
          <span className="material-symbols-outlined text-xl">event_note</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('home.mobileNav.services')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/auth">
          <span className="material-symbols-outlined text-xl">login</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{t('home.mobileNav.login')}</span>
        </a>
      </nav>
    </>
  )
}
