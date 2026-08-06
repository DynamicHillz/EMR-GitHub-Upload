import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  TestTube,
  Pill,
  Receipt,
  Settings,
  LogOut,
  UserCog,
  Activity,
  Bed,
  DoorOpen,
  ShieldAlert,
  Network,
  Baby,
  Syringe,
  BarChart3,
  Heart,
  Building2,
  BadgePercent,
  ShieldCheck,
  Scissors,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { loadAndApplyBranding } from '../../utils/theme';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import NetworkStatusIndicator, { SyncStatusIndicator } from '../NetworkStatusIndicator';
import NotificationBell from '../common/NotificationBell';
import { licenseService, LicenseStatusResult } from '../../services/license.service';

// Permission matrix per role — matches USER_MANAGEMENT_IMPLEMENTATION_PLAN.md
const navigation = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
  },
  {
    name: 'Patients',
    path: '/patients',
    icon: Users,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  },
  {
    name: 'Vitals',
    path: '/triage',
    icon: Activity,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Appointments',
    path: '/appointments',
    icon: Calendar,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  },
  {
    name: 'Consultations',
    path: '/consultations',
    icon: FileText,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
  },
  {
    name: 'Inpatient',
    path: '/inpatient',
    icon: Bed,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Surgery Log',
    path: '/surgery-log',
    icon: Scissors,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Labor Ward',
    path: '/labor-ward',
    icon: Heart,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Wards',
    path: '/wards',
    icon: DoorOpen,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'NURSE'],
  },
  {
    name: 'Maternal Care',
    path: '/mch',
    icon: Baby,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Immunizations Due',
    path: '/immunizations/due',
    icon: Syringe,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Postnatal Care Due',
    path: '/postnatal/due',
    icon: Baby,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'],
  },
  {
    name: 'Unnamed Newborns',
    path: '/newborns/unnamed',
    icon: Baby,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  },
  {
    name: 'Laboratory',
    path: '/lab',
    icon: TestTube,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH'],
  },
  {
    name: 'Pharmacy',
    path: '/pharmacy',
    icon: Pill,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST'],
  },
  {
    name: 'Billing',
    path: '/billing',
    icon: Receipt,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'CASHIER'],
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: BarChart3,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'User Management',
    path: '/users',
    icon: UserCog,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Clinics',
    path: '/tenants',
    icon: Building2,
    requiredRoles: ['SUPER_ADMIN'],
  },
  {
    name: 'Exemption Policies',
    path: '/exemption-policies',
    icon: BadgePercent,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Insurance Providers',
    path: '/insurance-providers',
    icon: ShieldCheck,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Audit Logs',
    path: '/audit',
    icon: ShieldAlert,
    requiredRoles: ['SUPER_ADMIN'],
  },
  {
    name: 'Interoperability',
    path: '/interoperability',
    icon: Network,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Sync Conflicts',
    path: '/sync-conflicts',
    icon: ShieldAlert,
    requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
  },
];

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const [branding, setBranding] = useState<any>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadAndApplyBranding(token).then(setBranding);
    }
  }, []);

  // Licensing enforcement is deliberately soft (see LICENSING.md) — this
  // banner is the only place it ever surfaces, and only to the roles who
  // can actually do something about it. Fetched once per session load, not
  // polled — a lapsed license doesn't need second-by-second freshness.
  useEffect(() => {
    if (!hasRole(['SUPER_ADMIN', 'ADMIN'])) return;
    licenseService.getStatus().then(setLicenseStatus).catch(() => setLicenseStatus(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const licenseBannerText = (() => {
    if (!licenseStatus || licenseStatus.status === 'ACTIVE') return null;
    if (licenseStatus.status === 'MISSING' || licenseStatus.status === 'INVALID') {
      return 'This installation is not licensed. Contact your vendor to activate it.';
    }
    const expiry = licenseStatus.claims?.maintenanceExpiresAt || 'an earlier date';
    const severity = licenseStatus.status === 'EXPIRED' ? 'Maintenance expired' : 'Maintenance is about to lapse';
    return `${severity} (${expiry}) — contact your vendor to renew. All clinical features remain fully available.`;
  })();

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Confirm Logout',
      message: 'Are you sure you want to logout? You will need to sign in again to access the system.',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (confirmed) logout();
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  };

  // Visible nav items for this user's role
  const visibleNav = navigation.filter(
    item => !item.requiredRoles || hasRole(item.requiredRoles)
  );

  // If user lands on a route they can't access, redirect to their home page
  const currentNav = navigation.find(item => location.pathname.startsWith(item.path));
  if (currentNav && currentNav.requiredRoles && !hasRole(currentNav.requiredRoles)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-center h-16 border-b px-4">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.clinicName || 'Clinic Logo'}
              className="max-h-14 max-w-[220px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <h1 className="text-2xl font-bold text-primary-600">
              {branding?.clinicName || 'SSMC EMR'}
            </h1>
          )}
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-6 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-600 border-r-4 border-primary-600' : ''
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
            <Link
              to="/settings"
              className={`flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ${
                location.pathname === '/settings' ? 'bg-gray-100 text-primary-600' : ''
              }`}
            >
              <Settings className="w-5 h-5 mr-3" />
              <span>Settings</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors mt-2"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8">
          <h2 className="text-xl font-semibold text-gray-800">
            {visibleNav.find((item) => location.pathname.startsWith(item.path))?.name || 'Dashboard'}
          </h2>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <NetworkStatusIndicator />
            <SyncStatusIndicator />
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
              <p className="text-xs text-gray-500">{user?.role || 'User'}</p>
            </div>
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
              {getUserInitials()}
            </div>
          </div>
        </header>

        {licenseBannerText && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-8 py-2 flex items-center justify-between">
            <span>⚠️ {licenseBannerText}</span>
            <Link to="/settings" className="font-medium underline hover:text-amber-900 whitespace-nowrap ml-4">
              Go to Settings
            </Link>
          </div>
        )}

        <div className="p-8">
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default MainLayout;