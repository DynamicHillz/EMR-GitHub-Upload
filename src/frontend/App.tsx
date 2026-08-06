import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth, getRoleHomePage } from './contexts/AuthContext';
import { ToastProvider } from './components/ToastContainer';

// Pages — lazy-loaded so each route's JS only downloads when actually
// visited, instead of one bundle containing every page in the app up front.
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const PatientsPage = React.lazy(() => import('./pages/PatientsPage'));
const AppointmentsPage = React.lazy(() => import('./pages/AppointmentsPage'));
const ConsultationsPage = React.lazy(() => import('./pages/ConsultationsPage'));
const PharmacyPage = React.lazy(() => import('./pages/PharmacyPage'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const MedicationsPage = React.lazy(() => import('./pages/MedicationsPage'));
const BillingPage = React.lazy(() => import('./pages/BillingPage'));

// Billing Pages
const ServiceCatalogPage = React.lazy(() => import('./pages/billing/ServiceCatalogPage'));
const InvoiceListPage = React.lazy(() => import('./pages/billing/InvoiceListPage'));
const CreateInvoicePage = React.lazy(() => import('./pages/billing/CreateInvoicePage'));
const InvoiceDetailPage = React.lazy(() => import('./pages/billing/InvoiceDetailPage'));
const PaymentListPage = React.lazy(() => import('./pages/billing/PaymentListPage'));
const OutstandingBalancesPage = React.lazy(() => import('./pages/billing/OutstandingBalancesPage'));
const RefundListPage = React.lazy(() => import('./pages/billing/RefundListPage'));
const UnbilledQueuePage = React.lazy(() => import('./pages/billing/UnbilledQueuePage'));

// User Management Pages
const UserListPage = React.lazy(() => import('./pages/users/UserListPage'));
const UserDetailPage = React.lazy(() => import('./pages/users/UserDetailPage'));
const CreateUserPage = React.lazy(() => import('./pages/users/CreateUserPage'));
const TenantsPage = React.lazy(() => import('./pages/TenantsPage'));
const CreateTenantPage = React.lazy(() => import('./pages/CreateTenantPage'));
const ExemptionPoliciesPage = React.lazy(() => import('./pages/ExemptionPoliciesPage'));
const InsuranceProvidersPage = React.lazy(() => import('./pages/InsuranceProvidersPage'));

// Settings Pages
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// Reports Pages
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));

// Additional Modules
const ConsumablesPage = React.lazy(() => import('./pages/ConsumablesPage'));
const ForceChangePasswordPage = React.lazy(() => import('./pages/ForceChangePasswordPage'));
const InpatientDetailsPage = React.lazy(() => import('./pages/InpatientDetailsPage'));
const InpatientPage = React.lazy(() => import('./pages/InpatientPage'));
const LaborWardPage = React.lazy(() => import('./pages/LaborWardPage'));
const SurgeryLogPage = React.lazy(() => import('./pages/SurgeryLogPage'));
const InteroperabilityPage = React.lazy(() => import('./pages/InteroperabilityPage'));
const SyncConflictsPage = React.lazy(() => import('./pages/SyncConflictsPage'));
const TriageDashboardPage = React.lazy(() => import('./pages/TriageDashboardPage'));
const VerificationPage = React.lazy(() => import('./pages/VerificationPage'));
const WardManagementPage = React.lazy(() => import('./pages/WardManagementPage'));
const MchDashboardPage = React.lazy(() => import('./pages/MchDashboardPage'));
const ImmunizationDuePage = React.lazy(() => import('./pages/mch/ImmunizationDuePage'));
const PostnatalDuePage = React.lazy(() => import('./pages/mch/PostnatalDuePage'));
const UnnamedNewbornsPage = React.lazy(() => import('./pages/mch/UnnamedNewbornsPage'));
const AuditDashboardPage = React.lazy(() => import('./pages/audit/AuditDashboardPage'));
const BillingDashboard = React.lazy(() => import('./pages/billing/BillingDashboard'));
const InsuranceClaimsDashboard = React.lazy(() => import('./pages/billing/InsuranceClaimsDashboard'));
const LabQueuePage = React.lazy(() => import('./pages/LabQueuePage'));
const LabReportPrintPage = React.lazy(() => import('./pages/lab/LabReportPrintPage'));
const ReceiptPrintPage = React.lazy(() => import('./pages/billing/ReceiptPrintPage'));
const DischargeSummaryPrintPage = React.lazy(() => import('./pages/inpatient/DischargeSummaryPrintPage'));
const NhmisMonthlyReturnPrintPage = React.lazy(() => import('./pages/reports/NhmisMonthlyReturnPrintPage'));
const LabCatalogPage = React.lazy(() => import('./pages/lab/LabCatalogPage'));

// Layout & Components — not lazy: needed immediately on every route.
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import BrandingProvider from './components/BrandingProvider';
import PageLoader from './components/common/PageLoader';

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
              <Suspense fallback={<PageLoader variant="full" />}>
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
                <Route
                  path="/reports/nhmis-monthly-return"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
                      <NhmisMonthlyReturnPrintPage />
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
                  <Route path="postnatal/due" element={<PostnatalDuePage />} />
                  <Route path="newborns/unnamed" element={<UnnamedNewbornsPage />} />

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
              </Suspense>
            </BrandingProvider>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;