/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';
import { User, LoginDto } from '../types/auth.types';
import { useToast } from '../components/ToastContainer';
import { AUTH_EXPIRED_EVENT, NO_TOKEN_EVENT, resumeSyncAfterLogin } from '../services/offlineSync';

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  login: (data: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const getRoleHomePage = (role: string): string => {
  switch (role) {
    case 'LAB_TECH':     return '/lab';
    case 'PHARMACIST':   return '/pharmacy';
    case 'CASHIER':      return '/billing';
    case 'NURSE':        return '/appointments';
    case 'RECEPTIONIST': return '/appointments';
    default:             return '/dashboard';
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  // A queued offline write couldn't be replayed because the session token
  // expired while this device was offline — let the user know so they can
  // log back in (the write itself is safe, just parked; see offlineSync.ts).
  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count || 0;
      toast.warning(
        'Session expired while offline',
        `${count} pending change${count === 1 ? '' : 's'} couldn't sync. Log in again to sync ${count === 1 ? 'it' : 'them'}.`
      );
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same idea, but for "not logged in at all" rather than "session expired
  // while offline" — e.g. the 15-minute inactivity auto-logout fired while
  // a write was still queued. Distinct wording since re-login here isn't
  // about a stale session, just logging back in at all.
  useEffect(() => {
    const handleNoToken = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count || 0;
      toast.warning(
        'Unsynced changes waiting',
        `${count} pending change${count === 1 ? '' : 's'} can't sync while logged out. Log in to sync ${count === 1 ? 'it' : 'them'}.`
      );
    };
    window.addEventListener(NO_TOKEN_EVENT, handleNoToken);
    return () => window.removeEventListener(NO_TOKEN_EVENT, handleNoToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = authService.getToken();
        const storedUser = authService.getCurrentUser();

        if (token && storedUser) {
          try {
            await authService.getUser(storedUser.id);
            setUser(storedUser);
          } catch (error: any) {
            console.warn('Stored token is invalid, clearing auth');
            authService.clearAuth();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        authService.clearAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // 15-minute inactivity timeout (900000 ms)
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (user) {
      timeoutRef.current = setTimeout(() => {
        console.log('User inactive for 15 minutes. Logging out...');
        toast.warning('Session Expired', 'You have been logged out due to 15 minutes of inactivity.');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout]);

  useEffect(() => {
    // Only track activity if a user is logged in
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      resetTimeout();
    };

    // Initialize timer
    resetTimeout();

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetTimeout]);

  const login = async (data: LoginDto) => {
    try {
      const response = await authService.login(data);
      const loggedInUser = response.user as any;
      setUser(loggedInUser);
      resumeSyncAfterLogin();

      if (loggedInUser.requirePasswordChange) {
        navigate('/force-change-password');
      } else {
        navigate(getRoleHomePage(loggedInUser.role));
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Unable to log in. Please check your credentials and try again.';
      throw new Error(errorMessage);
    }
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    setUser,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;