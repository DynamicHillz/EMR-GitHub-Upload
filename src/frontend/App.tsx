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
import UnbilledQueuePage from './pages/billing/UnbilledQueuePage';

// User Management Pages
import UserListPage from './pages/users/UserListPage';
import UserDetailPage from './pages/users/UserDetailPage';
import CreateUserPage from './pages/users/CreateUserPage';
import TenantsPage from './pages/TenantsPage';
import CreateTenantPage from './pages/CreateTenantPage';
import ExemptionPoliciesPage from './pages/ExemptionPoliciesPage';
import InsuranceProvidersPage from './pages/InsuranceProvidersPage';

// Settings Pages
import SettingsPage from './pages/SettingsPage';

// Reports Pages
import ReportsPage from './pages/ReportsPage';

// Additional Modules
import ConsumablesPage from './pages/ConsumablesPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import InpatientDetailsPage from './pages/InpatientDetailsPage';
import InpatientPage from './pages/InpatientPage';
import LaborWardPage from './pages/LaborWardPage';
import SurgeryLogPage from './pages/SurgeryLogPage';
import InteroperabilityPage from './pages/InteroperabilityPage';
import SyncConflictsPage from './pages/SyncConflictsPage';
import TriageDashboardPage from './pages/TriageDashboardPage';
import VerificationPage from './pages/VerificationPage';
import WardManagementPage from './pages/WardManagementPage';
import MchDashboardPage from './pages/MchDashboardPage';
import ImmunizationDuePage from './pages/mch/ImmunizationDuePage';
import AuditDashboardPage from './pages/audit/AuditDashboardPage';
import BillingDashboard from './pages/billing/BillingDashboard';
import InsuranceClaimsDashboard from './pages/billing/InsuranceClaimsDashboard';
import LabQueuePage from './pages/LabQueuePage';
import LabReportPrintPage from './pages/lab/LabReportPrintPage';
import ReceiptPrintPage from './pages/billing/ReceiptPrintPage';
import DischargeSummaryPrintPage from './pages/inpatient/DischargeSummaryPrintPage';
import LabCatalogPage from './pages/lab/LabCatalogPage';

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

                {/* Print Layout Routes */}
                <Route
                  path="/lab/report/:testId"
                  element={
                    <ProtectedRoute>
                      <LabReportPrintPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing/payments/:paymentId/receipt"
                  element={
                    <ProtectedRoute>
                      <ReceiptPrintPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inpatient/admissions/:admissionId/discharge-summary"
                  element={
                    <ProtectedRoute>
                      <DischargeSummaryPrintPage />
                    </ProtectedRoute>
                  }
                />

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
                  <Route path="lab" element={<LabQueuePage />} />
                  <Route path="lab/catalog" element={<LabCatalogPage />} />
                  <Route path="pharmacy" element={<PharmacyPage />} />
                  <Route path="pharmacy/inventory" element={<InventoryPage />} />
                  <Route path="pharmacy/medications" element={<MedicationsPage />} />
                  <Route path="pharmacy/consumables" element={<ConsumablesPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="billing/dashboard" element={<BillingDashboard />} />
                  <Route path="billing/insurance" element={<InsuranceClaimsDashboard />} />
                  <Route path="billing/services" element={<ServiceCatalogPage />} />
                  <Route path="billing/invoices" element={<InvoiceListPage />} />
                  <Route path="billing/invoices/new" element={<CreateInvoicePage />} />
                  <Route path="billing/invoices/:id" element={<InvoiceDetailPage />} />
                  <Route path="billing/payments" element={<PaymentListPage />} />
                  <Route path="billing/outstanding" element={<OutstandingBalancesPage />} />
                  <Route path="billing/unbilled" element={<UnbilledQueuePage />} />
                  <Route path="billing/refunds" element={<RefundListPage />} />

                  {/* Additional Routes */}
                  <Route path="triage" element={<TriageDashboardPage />} />
                  <Route path="inpatient" element={<InpatientPage />} />
                  <Route path="inpatient/:admissionId" element={<InpatientDetailsPage />} />
                  <Route path="labor-ward" element={<LaborWardPage />} />
                  <Route
                    path="surgery-log"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']}>
                        <SurgeryLogPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="wards" element={<WardManagementPage />} />
                  <Route path="interoperability" element={<InteroperabilityPage />} />
                  <Route
                    path="sync-conflicts"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN', 'DOCTOR']}>
                        <SyncConflictsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                        <AuditDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="verification" element={<VerificationPage />} />
                  <Route path="lab/queue" element={<LabQueuePage />} />
                  <Route path="force-change-password" element={<ForceChangePasswordPage />} />
                  <Route path="mch" element={<MchDashboardPage />} />
                  <Route path="immunizations/due" element={<ImmunizationDuePage />} />

                  {/* Reports & Analytics - Admin only */}
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />

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
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
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

                  {/* Clinics (Tenants) — SUPER_ADMIN only */}
                  <Route
                    path="tenants"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                        <TenantsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="tenants/new"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                        <CreateTenantPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Exemption Policies & Insurance Providers */}
                  <Route
                    path="exemption-policies"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <ExemptionPoliciesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="insurance-providers"
                    element={
                      <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                        <InsuranceProvidersPage />
                      </ProtectedRoute>
                    }
                  />
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