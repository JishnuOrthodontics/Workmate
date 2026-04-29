'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'

export default function Home() {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { ready, activeRole } = useAuth()

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
              <a className="text-emerald-900 border-b-2 border-emerald-900 pb-1 font-semibold hover:text-emerald-700 transition-colors font-h3 text-h3" href="/" style={{ fontSize: '16px', lineHeight: '24px' }}>Home</a>
              <a className="text-stone-600 font-medium hover:text-emerald-700 transition-colors font-body-md text-body-md" href="/search">Search Providers</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-stone-600 font-medium hover:text-emerald-700 transition-colors font-body-md text-body-md hidden md:block">Language</button>
            <a className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-emerald-200 transition-all font-label-md text-label-md" href={ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth'}>{ready && activeRole ? 'Dashboard' : 'Login'}</a>
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
                Kerala's Local Home Service Network
              </span>
              <h1 className="font-h1 text-h1 text-white">Trusted Local Professionals for Every Home Need.</h1>
              <p className="font-body-lg text-body-lg text-emerald-50 max-w-xl">
                Search verified electricians, plumbers, cleaners and more across Kerala. Book quickly with clear pricing and reliable support.
              </p>
              <form onSubmit={handleSearch} className="mt-8 relative max-w-2xl bg-white p-2 rounded-2xl shadow-2xl flex items-center border border-white/70">
                <span className="material-symbols-outlined text-stone-500 ml-3">search</span>
                <input 
                  className="w-full bg-transparent border-none focus:ring-0 text-stone-800 font-body-md text-body-md px-4 placeholder-stone-400" 
                  placeholder="What service do you need?" 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-6 py-3 rounded-xl font-label-md text-label-md shadow-lg whitespace-nowrap hover:opacity-95">Find Help</button>
              </form>
              <div className="flex flex-wrap gap-3">
                <a className="bg-white/10 border border-white/30 text-white px-5 py-2 rounded-xl font-label-md hover:bg-white/20 transition-colors" href="/search">
                  Search Providers
                </a>
                <a className="bg-white text-emerald-700 px-5 py-2 rounded-xl font-label-md hover:bg-emerald-50 transition-colors" href={ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth'}>
                  {ready && activeRole ? 'Go to Dashboard' : 'Login to Continue'}
                </a>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">Verified Providers</span>
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">Transparent Pricing</span>
                <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1">Fast Response</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <img alt="Beautiful traditional Kerala style home with lush green surroundings and sloping roof" className="w-full h-[400px] object-cover rounded-3xl shadow-2xl border border-white/20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkYF1IlyJvUaEahzBluPtjPEoUlHd0YkoC5joue80UUkDJz8u1RYgCVWgOp9fhgyL6WLkrC2D2W86nB6Hq-5DmTWJTJzevUPAHjw0zEBz0tYggViytpfntTmbcDI3e9FrRc-bawqUQ1BWNYE-rNvPFzo61n9DpWTEp-q5skbJA1dKqvz3Tvg0Q3KGWk6SGyoZnEzsECEiuj5Gw78ERLMQEAmpB6-FhB1j1qummWXomaoXdEZ_7a-Qw5Qan-S_79i7KDmvNPqhCpZmd" />
              <div className="absolute -bottom-6 -left-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl flex items-center gap-4 border border-white/70">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Verified Professionals</p>
                  <p className="font-caption text-caption text-on-surface-variant">Background checked & trained</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem -> Solution */}
        <section className="py-16 bg-gradient-to-b from-white to-emerald-50/40">
          <div className="max-w-screen-xl mx-auto px-6 grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">Finding Reliable Help is Hard</h3>
              <p className="text-on-surface-variant">Workmate lists verified local professionals with ratings and experience.</p>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">Unclear Pricing Creates Doubt</h3>
              <p className="text-on-surface-variant">Compare provider profiles, service rates, and choose confidently.</p>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="font-h3 text-h3 text-on-surface mb-2">Delays Affect Daily Life</h3>
              <p className="text-on-surface-variant">Book quickly and track service progress from your dashboard.</p>
            </div>
          </div>
        </section>

        {/* Service Discovery */}
        <section className="py-20 bg-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="font-h2 text-h2 text-on-surface mb-3">Find the Right Service Fast</h2>
              <p className="text-on-surface-variant">Popular categories with starting prices and quick response times.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=electrical">
                <p className="font-label-md text-label-md text-primary-container mb-1">Electrical</p>
                <p className="text-on-surface-variant text-sm mb-3">Starting ₹350 • Response in 30-60 min</p>
                <span className="text-primary font-medium">Search Electricians -&gt;</span>
              </a>
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=plumbing">
                <p className="font-label-md text-label-md text-primary-container mb-1">Plumbing</p>
                <p className="text-on-surface-variant text-sm mb-3">Starting ₹300 • Same day availability</p>
                <span className="text-primary font-medium">Search Plumbers -&gt;</span>
              </a>
              <a className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 hover:-translate-y-1 hover:shadow-xl transition-all" href="/search?q=cleaning">
                <p className="font-label-md text-label-md text-primary-container mb-1">Home Cleaning</p>
                <p className="text-on-surface-variant text-sm mb-3">Starting ₹500 • Verified teams</p>
                <span className="text-primary font-medium">Search Cleaning Pros -&gt;</span>
              </a>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="font-h2 text-h2 text-on-surface text-center mb-10">How Workmate Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">1. Search Service</p>
                <p className="text-on-surface-variant">Enter your need and location to discover relevant local providers.</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">2. Choose Verified Pro</p>
                <p className="text-on-surface-variant">Compare ratings, experience, and pricing before you decide.</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-white shadow-sm">
                <p className="text-primary-container font-bold mb-2">3. Book & Track</p>
                <p className="text-on-surface-variant">Confirm booking and follow updates in your customer dashboard.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust + Metrics */}
        <section className="py-16 bg-white">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-2xl border border-emerald-100 p-6 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">Trust & Safety First</h3>
                <ul className="space-y-2 text-on-surface-variant">
                  <li>- Provider verification and profile checks</li>
                  <li>- Transparent service pricing visibility</li>
                  <li>- In-app support and issue escalation options</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-100 p-6 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
                <h3 className="font-h3 text-h3 text-on-surface mb-3">Why Customers Choose Us</h3>
                <p className="text-on-surface-variant">Built for real local needs with dependable professionals and clear booking flow.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">12k+</p>
                <p className="text-sm text-on-surface-variant">Jobs Completed</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">4.8/5</p>
                <p className="text-sm text-on-surface-variant">Avg Customer Rating</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">3k+</p>
                <p className="text-sm text-on-surface-variant">Verified Providers</p>
              </div>
              <div className="bg-gradient-to-b from-white to-emerald-50 rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                <p className="font-h3 text-h3 text-primary">70%</p>
                <p className="text-sm text-on-surface-variant">Repeat Customers</p>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-16 bg-gradient-to-b from-white to-emerald-50/40">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="font-h2 text-h2 text-on-surface text-center mb-8">What Customers Say</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">“Booked a plumber in under 10 minutes. Great service and clear pricing.”</p>
                <p className="text-sm text-on-surface-variant">Anjali, Kochi • Plumbing</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">“The electrician arrived on time and fixed everything quickly.”</p>
                <p className="text-sm text-on-surface-variant">Ramesh, Palakkad • Electrical</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <p className="text-on-surface mb-3">“Very smooth booking and trustworthy professionals.”</p>
                <p className="text-sm text-on-surface-variant">Nisha, Thrissur • Home Cleaning</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 text-white">
          <div className="max-w-screen-xl mx-auto px-6 text-center">
            <h2 className="font-h2 text-h2 mb-3">Ready to Book a Trusted Home Service?</h2>
            <p className="text-emerald-50 mb-6">Search providers now or login to manage your bookings.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <a className="bg-white text-emerald-700 px-5 py-2 rounded-xl font-label-md hover:bg-emerald-50 transition-colors" href="/search">
                Start Searching
              </a>
              <a className="bg-white/10 border border-white/30 px-5 py-2 rounded-xl font-label-md hover:bg-white/20 transition-colors" href={ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth'}>
                {ready && activeRole ? 'Open Dashboard' : 'Login / Register'}
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
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">About Us</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">Contact</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">Privacy Policy</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">Terms of Service</a>
            <a className="text-stone-600 dark:text-stone-400 hover:text-[#5C4033] dark:hover:text-stone-200 font-['Inter'] text-sm" href="#">Service Partners</a>
          </nav>
          <div className="text-stone-600 dark:text-stone-400 font-['Inter'] text-sm">© 2024 Workmate Kerala • Customer support available across Kerala.</div>
        </div>
      </footer>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="bg-[#fdfbf7]/90 dark:bg-stone-900/90 backdrop-blur-md docked full-width bottom-0 rounded-t-2xl border-t border-t border-[#5C4033]/10 dark:border-stone-800 shadow-[0_-4px_12px_rgba(30,70,32,0.05)] fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 md:hidden">
        <a className="flex flex-col items-center justify-center text-[#1E4620] dark:text-emerald-400 bg-[#e8f0e8] dark:bg-emerald-900/40 rounded-xl px-3 py-1 active:bg-stone-100 dark:active:bg-stone-800 scale-95 transition-transform duration-200" href="/">
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Home</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/search">
          <span className="material-symbols-outlined text-xl">search</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Search</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/search">
          <span className="material-symbols-outlined text-xl">event_note</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Services</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 dark:text-stone-500 active:bg-stone-100 dark:active:bg-stone-800 px-3 py-1" href="/auth">
          <span className="material-symbols-outlined text-xl">login</span>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Login</span>
        </a>
      </nav>
    </>
  )
}
