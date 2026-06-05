import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';
import { User } from '../../../src/shared/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const u = await api.post<User>('/auth/login', { email, password });
    setUser(u);
  }

  async function register(email: string, password: string, name?: string) {
    const u = await api.post<User>('/auth/register', { email, password, name });
    setUser(u);
  }

  async function logout() {
    await api.post('/auth/logout', {});
    setUser(null);
  }

  async function updateProfile(name: string | null) {
    const updated = await api.put<User>('/auth/profile', { name });
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
