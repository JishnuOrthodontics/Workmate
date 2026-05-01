'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../auth-provider'
import { LanguageSwitcher } from '../language-switcher'
import { useLocale } from '../locale-provider'

type ProviderItem = {
  id: string;
  name: string;
  phone: string;
  category: string;
  skills: string[];
  hourlyRateFrom: number;
  rating: number;
  ratingCount?: number;
  distanceKm?: number;
  yearsExperience: number;
  district: string;
  locality: string;
  languages: Array<'en' | 'ml' | 'hi'>;
  isOnline: boolean;
  availabilityTags: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
const categories = ['Plumbing', 'Electrical', 'Carpentry'];
const ratingOptions = [4.5, 4.0, 3.5, 3.0]
const SEARCH_LOCATION_KEY = 'workmate.search.location.v1'

type SearchLocationState = {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  label: string;
  source: 'gps' | 'manual' | null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, activeRole } = useAuth();
  const { t } = useLocale();

  const languageOptions = useMemo(
    () =>
      [
        { code: 'en' as const, labelKey: 'search.filters.langEnglish' },
        { code: 'ml' as const, labelKey: 'search.filters.langMalayalam' },
        { code: 'hi' as const, labelKey: 'search.filters.langHindi' },
      ].map((row) => ({ code: row.code, label: t(row.labelKey) })),
    [t]
  );

  const categoryLabel = (category: string) => {
    const key = category.toLowerCase() as 'plumbing' | 'electrical' | 'carpentry';
    const map: Record<string, string> = {
      plumbing: t('search.categories.plumbing'),
      electrical: t('search.categories.electrical'),
      carpentry: t('search.categories.carpentry'),
    };
    return map[key] || category;
  };

  const spokenLanguageLabel = (code: 'en' | 'ml' | 'hi') =>
    code === 'en' ? t('search.filters.langEnglish') : code === 'ml' ? t('search.filters.langMalayalam') : t('search.filters.langHindi');
  const dashboardHref = ready
    ? activeRole === 'admin'
      ? '/admin/dashboard'
      : activeRole === 'provider'
      ? '/provider/dashboard'
      : activeRole === 'customer'
      ? '/dashboard'
      : '/auth?role=customer'
    : '/auth?role=customer';

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [locationState, setLocationState] = useState<SearchLocationState>({
    lat: parseOptionalNumber(searchParams.get('lat')),
    lng: parseOptionalNumber(searchParams.get('lng')),
    radiusKm: Number(searchParams.get('radiusKm') || '5') || 5,
    label: searchParams.get('locationLabel') || '',
    source: (searchParams.get('locationSource') as 'gps' | 'manual' | null) || null,
  });
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLanguages, setSelectedLanguages] = useState<Array<'en' | 'ml' | 'hi'>>(
    (searchParams.get('languages') || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x): x is 'en' | 'ml' | 'hi' => ['en', 'ml', 'hi'].includes(x))
  );
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [availableToday, setAvailableToday] = useState(searchParams.get('availableToday') === 'true');
  const [weekends, setWeekends] = useState(searchParams.get('weekends') === 'true');
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const shouldUseSaved = !searchParams.get('lat') && !searchParams.get('lng') && !searchParams.get('location') || searchParams.get('useSavedLocation') === '1';
    if (!shouldUseSaved) return;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SEARCH_LOCATION_KEY) : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SearchLocationState;
      if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
        setLocationState({
          lat: Number(parsed.lat),
          lng: Number(parsed.lng),
          radiusKm: Math.min(20, Math.max(1, Number(parsed.radiusKm) || 5)),
          label: String(parsed.label || ''),
          source: parsed.source === 'manual' ? 'manual' : 'gps',
        });
        setLocation(parsed.label || '');
      } else if (parsed.label) {
        setLocation(parsed.label);
      }
    } catch {
      // ignore invalid saved location
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (searchParams.get('lat') && searchParams.get('lng')) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationState((prev) => ({
          ...prev,
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
          source: 'gps',
          label: prev.label || t('search.currentLocation'),
        }));
        setLocation((prev) => prev || t('search.currentLocation'));
      },
      () => {
        // User denied or unavailable; keep manual location search path.
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [searchParams, t]);

  const paramsString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (location.trim()) params.set('location', location.trim());
    if (locationState.lat !== null && locationState.lng !== null) {
      params.set('lat', String(locationState.lat));
      params.set('lng', String(locationState.lng));
      params.set('radiusKm', String(locationState.radiusKm));
      if (locationState.source) params.set('locationSource', locationState.source);
      if (locationState.label.trim()) params.set('locationLabel', locationState.label.trim());
    }
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedLanguages.length > 0) params.set('languages', selectedLanguages.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating) params.set('minRating', minRating);
    if (availableToday) params.set('availableToday', 'true');
    if (weekends) params.set('weekends', 'true');
    params.set('page', String(page));
    params.set('pageSize', '12');
    return params.toString();
  }, [query, location, locationState, selectedCategory, selectedLanguages, minPrice, maxPrice, minRating, availableToday, weekends, page]);

  useEffect(() => {
    router.replace(`/search?${paramsString}`);
  }, [paramsString, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (locationState.lat !== null && locationState.lng !== null) {
      window.localStorage.setItem(SEARCH_LOCATION_KEY, JSON.stringify(locationState));
      return;
    }
    if (location.trim()) {
      window.localStorage.setItem(
        SEARCH_LOCATION_KEY,
        JSON.stringify({
          ...locationState,
          label: location.trim(),
        } satisfies SearchLocationState)
      );
    }
  }, [locationState, location]);

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
        setError(err instanceof Error ? err.message : t('search.results.fetchError'));
        setProviders([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [paramsString, t]);

  const clearAll = () => {
    setQuery('');
    setLocation('');
    setLocationState({ lat: null, lng: null, radiusKm: 5, label: '', source: null });
    setSelectedCategory('');
    setSelectedLanguages([]);
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
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
                <a className="text-stone-600 font-medium hover:text-emerald-700 transition-colors" href="/">{t('nav.home')}</a>
              ) : null}
              <a className="text-emerald-900 border-b-2 border-emerald-900 pb-1 font-bold hover:text-emerald-700 transition-colors" href="/search">{t('nav.searchProviders')}</a>
            </div>
          </div>
          <div className="flex-1 max-w-md mx-6 hidden lg:block">
            <div className="relative flex items-center w-full h-10 rounded-full bg-white overflow-hidden border border-emerald-100 shadow-sm focus-within:border-emerald-400 transition-colors">
              <div className="grid place-items-center h-full w-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">search</span>
              </div>
              <input className="peer h-full w-full outline-none text-sm text-on-surface bg-transparent pr-2 font-body-md" placeholder={t('search.placeholders.services')} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
              <div className="h-6 w-[1px] bg-outline-variant mx-2"></div>
              <div className="grid place-items-center h-full w-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">location_on</span>
              </div>
              <input className="peer h-full w-44 outline-none text-sm text-on-surface bg-transparent pr-4 font-body-md" placeholder={t('search.placeholders.area')} type="text" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <a
              className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-4 py-2 rounded-xl font-label-md font-medium hover:opacity-95 shadow-lg transition-opacity"
              href={dashboardHref}
            >
              {ready && activeRole ? t('search.myDashboard') : t('nav.login')}
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8 bg-gradient-to-b from-white to-emerald-50/40">
        <div className="md:hidden w-full mb-4 flex flex-col gap-2">
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
          <div className="relative flex items-center w-full h-12 rounded-full bg-white overflow-hidden border border-emerald-100 shadow-sm focus-within:border-emerald-400 transition-colors">
            <div className="grid place-items-center h-full w-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-lg">search</span>
            </div>
            <input className="peer h-full w-full outline-none text-sm text-on-surface bg-transparent pr-2 font-body-md" placeholder={t('search.placeholders.mobileQuery')} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
          </div>
        </div>

        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white/90 backdrop-blur rounded-2xl border border-emerald-100 p-6 sticky top-24 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-h3 text-h3 text-on-surface">{t('search.filters.title')}</h2>
              <button className="text-primary-container font-label-md text-label-md hover:underline" onClick={clearAll}>{t('search.filters.clearAll')}</button>
            </div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">{t('search.filters.category')}</h3>
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
                    <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{categoryLabel(category)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">{t('search.filters.providerLanguages')}</h3>
              <div className="space-y-2">
                {languageOptions.map((language) => (
                  <label className="flex items-center gap-3 cursor-pointer group" key={language.code}>
                    <input
                      className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container"
                      type="checkbox"
                      checked={selectedLanguages.includes(language.code)}
                      onChange={() => {
                        setSelectedLanguages((prev) =>
                          prev.includes(language.code)
                            ? prev.filter((x) => x !== language.code)
                            : [...prev, language.code]
                        );
                        setPage(1);
                      }}
                    />
                    <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{language.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">{t('search.filters.priceRange')}</h3>
              <div className="flex items-center gap-2">
                <input className="w-full h-10 rounded-md border-outline-variant bg-surface-container-high text-sm px-3 focus:ring-1 focus:ring-primary-container focus:border-primary-container outline-none" placeholder={t('search.filters.min')} type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} />
                <span className="text-on-surface-variant">-</span>
                <input className="w-full h-10 rounded-md border-outline-variant bg-surface-container-high text-sm px-3 focus:ring-1 focus:ring-primary-container focus:border-primary-container outline-none" placeholder={t('search.filters.max')} type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div className="mb-6">
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">{t('search.filters.minRating')}</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    className="w-4 h-4 text-primary-container focus:ring-primary-container border-outline-variant bg-surface-container"
                    name="rating"
                    type="radio"
                    checked={minRating === ''}
                    onChange={() => {
                      setMinRating('');
                      setPage(1);
                    }}
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{t('search.filters.anyRating')}</span>
                </label>
                {ratingOptions.map((rating) => (
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
                      <span className="font-body-md text-body-md">{t('search.filters.ratingUp', { rating: String(rating) })}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-[#5C4033]/10 mb-6"></div>

            <div>
              <h3 className="font-label-md text-label-md font-bold text-on-surface mb-3 uppercase tracking-wider text-xs">{t('search.filters.availability')}</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container" type="checkbox" checked={availableToday} onChange={(e) => { setAvailableToday(e.target.checked); setPage(1); }} />
                  <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{t('search.filters.availableToday')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container bg-surface-container" type="checkbox" checked={weekends} onChange={(e) => { setWeekends(e.target.checked); setPage(1); }} />
                  <span className="font-body-md text-body-md text-on-surface-variant group-hover:text-on-surface transition-colors">{t('search.filters.weekends')}</span>
                </label>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6">
            <h1 className="font-h2 text-h2 text-on-surface mb-2">{query || selectedCategory ? t('search.results.filteredTitle') : t('search.results.nearYouTitle')}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {t('search.results.showing', { total: String(total) })}
              {locationState.lat !== null && locationState.lng !== null ? t('search.results.withinKm', { radius: String(locationState.radiusKm) }) : ''}
            </p>
          </div>

          {loading && <div className="rounded-xl border border-emerald-100 bg-white p-6 text-stone-600">{t('search.results.loading')}</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{t('search.results.errorPrefix')} {error}</div>}

          {!loading && !error && providers.length === 0 && (
            <div className="rounded-xl border border-emerald-100 bg-white p-6 text-stone-600">
              {t('search.results.empty')}
              {locationState.lat !== null && locationState.lng !== null ? t('search.results.emptyNearby', { radius: String(locationState.radiusKm) }) : ''}
            </div>
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
                      <span className="font-label-md text-label-md text-xs font-bold">{t('search.card.verified')}</span>
                    </div>
                  </div>
                  <div className="mb-4 flex-1">
                    <h3 className="font-h3 text-h3 text-on-surface text-lg mb-1 group-hover:text-primary-container transition-colors">{provider.name}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm mb-2">{provider.category} • {provider.locality || provider.district}</p>
                    {typeof provider.distanceKm === 'number' ? (
                      <p className="mb-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {t('search.card.kmAway', { distance: provider.distanceKm.toFixed(1) })}
                      </p>
                    ) : null}
                    {provider.languages?.length > 0 ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {provider.languages.slice(0, 3).map((code) => (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800" key={`${provider.id}-${code}`}>
                            {spokenLanguageLabel(code)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {provider.isOnline ? <p className="text-[11px] font-semibold text-emerald-700 mb-1">{t('search.card.onlineNow')}</p> : null}
                    <p className="font-caption text-caption text-on-surface-variant mb-3">{provider.availabilityTags.join(' • ')}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-on-surface">
                        <span className="material-symbols-outlined text-[#FFB400] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="font-bold">{Number(provider.rating || 0).toFixed(1)}</span>
                        <span className="text-[11px] text-on-surface-variant">({Number(provider.ratingCount || 0)})</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">history</span>
                        <span>{t('search.card.yrsExp', { years: String(provider.yearsExperience) })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#5C4033]/10">
                    <div className="font-body-md text-body-md text-on-surface font-semibold">
                      ₹{provider.hourlyRateFrom || 0} <span className="text-sm font-normal text-on-surface-variant">{t('search.card.perHour')}</span>
                    </div>
                    <a href={`/profile?providerId=${provider.id}`} className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-5 py-2 rounded-xl font-label-md text-label-md hover:opacity-95 transition-colors shadow-sm">{t('search.card.viewBook')}</a>
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
              <span className="px-3 text-sm text-on-surface-variant">{t('search.pagination.pageOf', { page: String(page), total: String(totalPages) })}</span>
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
            <span>{t('nav.home')}</span>
          </a>
        ) : null}
        <a className="flex flex-col items-center justify-center text-emerald-700 bg-emerald-100 rounded-xl px-4 py-2 cursor-pointer transition-transform duration-200" href="/search">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
          <span>{t('home.mobileNav.search')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 active:bg-stone-100 p-2 rounded-lg cursor-pointer" href={ready && activeRole ? dashboardHref : '/auth?role=customer'}>
          <span className="material-symbols-outlined mb-1">event_note</span>
          <span>{ready && activeRole ? t('search.mobile.dashboard') : t('search.mobile.bookings')}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-stone-500 active:bg-stone-100 p-2 rounded-lg cursor-pointer" href="/profile">
          <span className="material-symbols-outlined mb-1">person</span>
          <span>{t('search.mobile.account')}</span>
        </a>
      </nav>
    </>
  )
}

function SearchPageSuspenseFallback() {
  const { t } = useLocale()
  return <div className="p-6 text-stone-600">{t('search.loadingPage')}</div>
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSuspenseFallback />}>
      <SearchPageContent />
    </Suspense>
  )
}
