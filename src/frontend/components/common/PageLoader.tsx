import React from 'react';

interface PageLoaderProps {
  /** Use 'full' as the React.lazy Suspense fallback (fills the viewport); 'inline' for a smaller in-page loading state (e.g. a tab panel). */
  variant?: 'full' | 'inline';
}

// Shared spinner — previously the same markup was copy-pasted with slightly
// different sizes/colors across InvoiceList.tsx, PatientDetailView.tsx, and
// others. Also used as App.tsx's Suspense fallback for lazy-loaded routes.
const PageLoader: React.FC<PageLoaderProps> = ({ variant = 'inline' }) => {
  const containerClass = variant === 'full' ? 'flex items-center justify-center h-screen' : 'flex justify-center items-center py-12';
  const spinnerClass = variant === 'full' ? 'h-16 w-16' : 'h-12 w-12';

  return (
    <div className={containerClass}>
      <div className={`animate-spin rounded-full border-b-2 border-primary-600 ${spinnerClass}`}></div>
    </div>
  );
};

export default PageLoader;
