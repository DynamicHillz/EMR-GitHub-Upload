/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';
import { User, LoginDto, RegisterDto } from '../types/auth.types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginDto) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
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

  const login = async (data: LoginDto) => {
    try {
      const response = await authService.login(data);
      const loggedInUser = response.user as any;
      setUser(loggedInUser);
      navigate(getRoleHomePage(loggedInUser.role));
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Unable to log in. Please check your credentials and try again.';
      throw new Error(errorMessage);
    }
  };

  const register = async (data: RegisterDto) => {
    try {
      const response = await authService.register(data);
      const registeredUser = response.user as any;
      setUser(registeredUser);
      navigate(getRoleHomePage(registeredUser.role));
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Unable to register. Please check your information and try again.';
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      navigate('/login');
    }
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;