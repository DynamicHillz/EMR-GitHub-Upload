import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth, getRoleHomePage } from './contexts/AuthContext';
import { ToastProvider } from './components/ToastContainer';

// Pages
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ConsultationsPage from './pages/ConsultationsPage';
import LabPage from './pages/LabPage';
import PharmacyPage from './pages/PharmacyPage';
import InventoryPage from './pages/InventoryPage';
import MedicationsPage from './pages/MedicationsPage';
import BillingPage from './pages/BillingPage';

// Billing Pages
import ServiceCatalogPage from './pages/billing/ServiceCatalogPage';
import InvoiceListPage from './pages/billing/InvoiceListPage';
import CreateInvoicePage from './pages/billing/CreateInvoicePage';
import InvoiceDetailPage from './pages/billing/InvoiceDetailPage';
import PaymentListPage from './pages/billing/PaymentListPage';
import OutstandingBalancesPage from './pages/billing/OutstandingBalancesPage';
import RefundListPage from './pages/billing/RefundListPage';

// User Management Pages
import UserListPage from './pages/users/UserListPage';
import UserDetailPage from './pages/users/UserDetailPage';
import CreateUserPage from './pages/users/CreateUserPage';

// Settings Pages
import SettingsPage from './pages/SettingsPage';

// Layout & Components
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import BrandingProvider from './components/BrandingProvider';

// Redirects user to their role-appropriate home page
const RoleRedirect: React.FC = () => {
  const { user } = useAuth();
  return <Navigate to={getRoleHomePage(user?.role ?? '')} replace />;
};

// Redirects away from /dashboard if role doesn't need it
const DashboardGuard: React.FC = () => {
  const { user } = useAuth();
  const dashboardRoles = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'];
  if (user && !dashboardRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePage(user.role)} replace />;
  }
  return <DashboardPage />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Router>
          <AuthProvider>
            <BrandingProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<RoleRedirect />} />
                  <Route path="dashboard" element={<DashboardGuard />} />
                  <Route path="patients" element={<PatientsPage />} />
                  <Route path="appointments" element={<AppointmentsPage />} />
                  <Route path="consultations" element={<ConsultationsPage />} />
                  <Route path="lab" element={<LabPage />} />
                  <Route path="pharmacy" element={<PharmacyPage />} />
                  <Route path="pharmacy/inventory" element={<InventoryPage />} />
                  <Route path="pharmacy/medications" element={<MedicationsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="billing/services" element={<ServiceCatalogPage />} />
                  <Route path="billing/invoices" element={<InvoiceListPage />} />
                  <Route path="billing/invoices/new" element={<CreateInvoicePage />} />
                  <Route path="billing/invoices/:id" element={<InvoiceDetailPage />} />
                  <Route path="billing/payments" element={<PaymentListPage />} />
                  <Route path="billing/outstanding" element={<OutstandingBalancesPage />} />
                  <Route path="billing/refunds" element={<RefundListPage />} />

                  {/* Settings - Admin only */}
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* User Management */}
                  <Route
                    path="users"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                        <UserListPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="users/new"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <CreateUserPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="users/:id" element={<UserDetailPage />} />
                </Route>

                {/* 404 catch-all */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrandingProvider>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;