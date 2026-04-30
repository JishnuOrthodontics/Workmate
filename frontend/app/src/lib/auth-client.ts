export type AuthRole = 'customer' | 'provider' | 'admin'

export type SessionUser = {
  isAuthenticated: boolean;
  uid?: string;
  name: string;
  phone: string;
  location?: string;
  service?: string;
  token?: string;
};

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3334';

const CUSTOMER_KEY = 'workmate_customer_auth';
const PROVIDER_KEY = 'workmate_provider_auth';
const ADMIN_KEY = 'workmate_admin_auth';

export function getSessionKey(role: AuthRole) {
  if (role === 'customer') return CUSTOMER_KEY;
  if (role === 'provider') return PROVIDER_KEY;
  return ADMIN_KEY;
}

export function getSession(role: AuthRole): SessionUser | null {
  const raw = localStorage.getItem(getSessionKey(role));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(role: AuthRole, session: SessionUser) {
  localStorage.setItem(getSessionKey(role), JSON.stringify(session));
}

export function clearSession(role: AuthRole) {
  localStorage.removeItem(getSessionKey(role));
}

export function clearAllSessions() {
  localStorage.removeItem(CUSTOMER_KEY);
  localStorage.removeItem(PROVIDER_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export async function registerUser(payload: {
  name: string;
  phone: string;
  password: string;
  role: AuthRole;
  location?: string;
  service?: string;
}) {
  const response = await fetch(`${AUTH_API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Registration failed');
  }
  return data;
}

export async function loginUser(payload: {
  phone: string;
  password: string;
  role: AuthRole;
}) {
  const response = await fetch(`${AUTH_API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Login failed');
  }
  return data;
}
