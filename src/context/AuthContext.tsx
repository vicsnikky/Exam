import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  refreshUser: async () => null,
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (explicitToken?: string | null): Promise<User | null> => {
    const activeToken = explicitToken || token || sessionStorage.getItem('sqams_token');
    if (!activeToken) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
          sessionStorage.setItem('sqams_user', JSON.stringify(data.user));
          return data.user;
        }
      }
    } catch (err) {
      console.warn('Auth user refresh deferred:', err);
    }
    return null;
  }, [token]);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('sqams_token');
    const savedUser = sessionStorage.getItem('sqams_user');
    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Session restore error:', e);
        }
      }
      // Proactively refresh live user profile from server so assigned classes & roles sync immediately
      refreshUser(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const handleClassTeachersUpdated = () => {
      refreshUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };

    window.addEventListener('fis:class-teachers-updated', handleClassTeachersUpdated);
    window.addEventListener('fis:teachers-updated', handleClassTeachersUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('fis:class-teachers-updated', handleClassTeachersUpdated);
      window.removeEventListener('fis:teachers-updated', handleClassTeachersUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('sqams_token', newToken);
    sessionStorage.setItem('sqams_user', JSON.stringify(newUser));
    // Immediately sync with server /api/auth/me to fetch canonical role flags
    refreshUser(newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('sqams_token');
    sessionStorage.removeItem('sqams_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
