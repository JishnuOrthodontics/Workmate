'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { clearAllSessions, clearSession, getSession, type AuthRole } from '../lib/auth-client'

type Session = {
  isAuthenticated: boolean;
  uid?: string;
  name: string;
  phone: string;
  location?: string;
  service?: string;
  token?: string;
} | null;

type AuthContextValue = {
  ready: boolean;
  customerSession: Session;
  providerSession: Session;
  adminSession: Session;
  activeRole: AuthRole | null;
  logout: (role?: AuthRole) => void;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [customerSession, setCustomerSession] = useState<Session>(null);
  const [providerSession, setProviderSession] = useState<Session>(null);
  const [adminSession, setAdminSession] = useState<Session>(null);

  const refresh = () => {
    const customer = getSession('customer');
    const provider = getSession('provider');
    const admin = getSession('admin');
    setCustomerSession(customer?.isAuthenticated ? customer : null);
    setProviderSession(provider?.isAuthenticated ? provider : null);
    setAdminSession(admin?.isAuthenticated ? admin : null);
    setReady(true);
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = (role?: AuthRole) => {
    if (!role) {
      clearAllSessions();
    } else {
      clearSession(role);
    }
    refresh();
  };

  const value = useMemo<AuthContextValue>(() => {
    const activeRole: AuthRole | null = adminSession
      ? 'admin'
      : providerSession
      ? 'provider'
      : customerSession
      ? 'customer'
      : null;
    return { ready, customerSession, providerSession, adminSession, activeRole, logout, refresh };
  }, [ready, customerSession, providerSession, adminSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
