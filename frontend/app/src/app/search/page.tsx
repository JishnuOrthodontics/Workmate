'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../auth-provider'

type ProviderItem = {
  id: string;
  name: string;
  phone: string;
  category: string;
  skills: string[];
  hourlyRateFrom: number;
  rating: number;
  yearsExperience: number;
  district: string;
  locality: string;
  isOnline: boolean;
  availabilityTags: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
const categories = ['Plumbing', 'Electrical', 'Carpentry'];

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, activeRole } = useAuth();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '4');
  const [availableToday, setAvailableToday] = useState(searchParams.get('availableToday') === 'true');
  const [weekends, setWeekends] = useState(searchParams.get('weekends') === 'true');
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const paramsString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (location.trim()) params.set('location', location.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating) params.set('minRating', minRating);
    if (availableToday) params.set('availableToday', 'true');
    if (weekends) params.set('weekends', 'true');
    params.set('page', String(page));
    params.set('pageSize', '12');
    return params.toString();
  }, [query, location, selectedCategory, minPrice, maxPrice, minRating, availableToday, weekends, page]);

  useEffect(() => {
    router.replace(`/search?${paramsString}`);
  }, [paramsString, router]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/providers/search?${paramsString}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        const data = json?.data;
        setProviders(data?.items || []);
        setTotal(data?.total || 0);
        setTotalPages(data?.totalPages || 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch providers');
        setProviders([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [paramsString]);

  const clearAll = () => {
    setQuery('');
    setLocation('');
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('4');
    setAvailableToday(false);
    setWeekends(false);
    setPage(1);
  };

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-xl font-['Inter'] antialiased docked full-width top-0 border-b border-emerald-900/10 shadow-sm sticky z-40">
        <div className="flex justify-between items-center h-16 w-full px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-6">
            <a className="text-2xl font-black tracking-tight text-emerald-900" href="/">Workmate</a>
            <div className="hidden md:flex items-center gap-6 ml-6">
              {activeRole !== 'customer' ? (
                <a className="text-stone-600 font-medium hover:text-emerald-700 transition-colors" href="/">Home</a>
              ) : null}
              <a className="text-emerald-900 border-b-2 border-emerald-900 pb-1 font-bold hover:text-emerald-700 transition-colors" href="/search">Search Providers</a>
            </div>
          </div>
          <div className="flex-1 max-w-md mx-6 hidden lg:block">
            <div className="relative flex items-center w-full h-10 rounded-full bg-white overflow-hidden border border-emerald-100 shadow-sm focus-within:border-emerald-400 transition-colors">
              <div className="grid place-items-center h-full w-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">search</span>
              </div>
              <input className="peer h-full w-full outline-none text-sm text-on-surface bg-transparent pr-2 font-body-md" placeholder="Search services..." type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
              <div className="h-6 w-[1px] bg-outline-variant mx-2"></div>
              <div className="grid place-items-center h-full w-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">location_on</span>
              </div>
              <input className="peer h-full w-32 outline-none text-sm text-on-surface bg-transparent pr-4 font-body-md" placeholder="Location..." type="text" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-stone-600 font-medium hover:text-emerald-700 transition-colors hidden sm:block">Language</button>
            <a
              className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-4 py-2 rounded-xl font-label-md font-medium hover:opacity-95 shadow-lg transition-opacity"
              href={ready && activeRole === 'provider' ? '/provider/dashboard' : ready && activeRole === 'customer' ? '/dashboard' : '/auth?role=customer'}
            >
              {ready && activeRole ? 'My Dashboard' : 'Login'}
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8 bg-gradient-to-b from-white to-emerald-50/40">
        <div className="md:hidden w-full mb-4">
          <div className="relative flex items-center w-full h-12 rounded-full bg-white overflow-hidden border border-emerald-100 shadow-sm focus-within:border-emerald-400 transition-colors">
            <div className="grid place-items-center h-full w-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-lg">search</span>
            </div>
            <input className="peer h-full w-full outline-none text-sm text-on-surface bg-transparent pr-2 font-body-md" placeholder="Search providers or services..." type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
          </div>
        </div>

        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white/90 backdrop-blur rounded-2xl border border-emerald-100 p-6 sticky top-24 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-h3 text-h3 text-on-surface">Filters</h2>
              <button className="text-primary-container font-label-md text-label-md hover:underline" onClick={clearAll}>Clear all</button>
            </div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">Category</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <label className="flex items-center gap-3 cursor-pointer group" key={category}>
                    <input
                      className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container"
                      type="checkbox"
                      checked={selectedCategory === category.toLowerCase()}
                      onChange={() => {
                        setSelectedCategory(selectedCategory === category.toLowerCase() ? '' : category.toLowerCase());
                        setPage(1);
                      }}
                    />
                    <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{category}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">Price Range (₹)</h3>
              <div className="flex items-center gap-2">
                <input className="w-full h-10 rounded-md border-outline-variant bg-surface-container-high text-sm px-3 focus:ring-1 focus:ring-primary-container focus:border-primary-container outline-none" placeholder="Min" type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} />
                <span className="text-on-surface-variant">-</span>
                <input className="w-full h-10 rounded-md border-outline-variant bg-surface-container-high text-sm px-3 focus:ring-1 focus:ring-primary-container focus:border-primary-container outline-none" placeholder="Max" type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">Minimum Rating</h3>
              <div className="space-y-2">
                {[4.5, 4.0].map((rating) => (
                  <label className="flex items-center gap-3 cursor-pointer group" key={rating}>
                    <input
                      className="w-4 h-4 text-primary-container focus:ring-primary-container border-outline-variant bg-surface-container"
                      name="rating"
                      type="radio"
                      checked={Number(minRating) === rating}
                      onChange={() => {
                        setMinRating(String(rating));
                        setPage(1);
                      }}
                    />
                    <div className="flex items-center text-on-surface-variant group-hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-sm text-[#FFB400] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-body-md text-body-md">{rating} & up</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div>
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">Availability</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container" type="checkbox" checked={availableToday} onChange={(e) => { setAvailableToday(e.target.checked); setPage(1); }} />
                  <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">Available Today</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container" type="checkbox" checked={weekends} onChange={(e) => { setWeekends(e.target.checked); setPage(1); }} />
                  <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">Weekends</span>
                </label>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6">
            <h1 className="font-h2 text-h2 text-on-surface mb-2">{query || selectedCategory ? 'Filtered Provider Results' : 'Search Providers Near You'}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Showing {total} verified professionals</p>
          </div>

          {loading && <div className="rounded-xl border border-emerald-100 bg-white p-6 text-stone-600">Loading providers...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">Failed to load: {error}</div>}

          {!loading && !error && providers.length === 0 && (
            <div className="rounded-xl border border-emerald-100 bg-white p-6 text-stone-600">No providers matched your filters. Try widening your search.</div>
          )}

          {!loading && !error && providers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-100 p-6 transition-all duration-300 flex flex-col group relative overflow-hidden hover:-translate-y-1" key={provider.id}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary-container opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="font-h3 text-h3 text-primary-container">{provider.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="bg-[#e8f0e8] text-primary-container px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <span className="font-label-md text-label-md text-xs font-bold">Verified</span>
                    </div>
                  </div>
                  <div className="mb-4 flex-1">
                    <h3 className="font-h3 text-h3 text-on-surface text-lg mb-1 group-hover:text-primary-container transition-colors">{provider.name}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mb-2">{provider.category} • {provider.locality || provider.district}</p>
                    {provider.isOnline ? <p className="text-[11px] font-semibold text-emerald-700 mb-1">Online now</p> : null}
                    <p className="font-caption text-caption text-on-surface-variant mb-3">{provider.availabilityTags.join(' • ')}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-on-surface">
                        <span className="material-symbols-outlined text-[#FFB400] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="font-bold">{provider.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">history</span>
                        <span>{provider.yearsExperience} yrs exp.</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#5C4033]/10">
                    <div className="font-body-md text-body-md text-on-surface font-semibold">
                      ₹{provider.hourlyRateFrom || 0} <span className="text-sm font-normal text-on-surface-variant">/hr</span>
                    </div>
                    <a href={`/profile?providerId=${provider.id}`} className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-5 py-2 rounded-xl font-label-md text-label-md hover:opacity-95 transition-colors shadow-sm">View & Book</a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center gap-2">
              <button className="w-10 h-10 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="px-3 text-sm text-on-surface-variant">Page {page} of {totalPages}</span>
              <button className="w-10 h-10 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <nav className="bg-white/85 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-emerald-700 docked full-width bottom-0 rounded-t-2xl border-t border-emerald-100 shadow-[0_-4px_12px_rgba(30,70,32,0.05)] fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 md:hidden">
        {activeRole !== 'customer' ? (
          <a className="flex flex-col items-center justify-center text-stone-500 active:bg-stone-100 p-2 rounded-lg cursor-pointer" href="/">
            <span className="material-symbols-outlined mb-1">home</span>
            <span>Home</span>
          </a>
        ) : null}
        <a className="flex flex-col items-center justify-center text-emerald-700 bg-emerald-100 rounded-xl px-4 py-2 cursor-pointer transition-transform duration-200" href="/search">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
          <span>Search</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 active:bg-stone-100 p-2 rounded-lg cursor-pointer" href={ready && activeRole ? '/dashboard' : '/auth?role=customer'}>
          <span className="material-symbols-outlined mb-1">event_note</span>
          <span>{ready && activeRole ? 'Dashboard' : 'Bookings'}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 active:bg-stone-100 p-2 rounded-lg cursor-pointer" href="/profile">
          <span className="material-symbols-outlined mb-1">person</span>
          <span>Account</span>
        </a>
      </nav>
    </>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-600">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
