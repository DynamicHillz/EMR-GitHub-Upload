/**
 * Branding Provider
 * Loads and applies branding globally when the app starts
 */

import React, { useEffect } from 'react';
import { loadAndApplyBranding } from '../utils/theme';

interface BrandingProviderProps {
  children: React.ReactNode;
}

const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  useEffect(() => {
    // Load branding on mount if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      loadAndApplyBranding(token).catch(err => {
        console.error('Failed to load branding:', err);
      });
    }

    // Listen for login events to reload branding
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      if (newToken) {
        loadAndApplyBranding(newToken);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return <>{children}</>;
};

export default BrandingProvider;
