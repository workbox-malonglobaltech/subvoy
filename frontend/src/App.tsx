import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminGuard } from './components/admin/AdminGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SmartRoot } from './components/SmartRoot';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EmailImportPage } from './pages/EmailImportPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { WalletPage } from './pages/WalletPage';
import { ReportsPage } from './pages/ReportsPage';
import { CompliancePage } from './pages/CompliancePage';
import { PaymentCallbackPage } from './pages/PaymentCallbackPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { InstallBanner } from './components/InstallBanner';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminErrorsPage } from './pages/admin/AdminErrorsPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
        <ToastProvider>
          <ErrorBoundary>
            <InstallBanner />
            <Routes>
              {/* Public root — shows LandingPage for guests, DashboardPage for authenticated users */}
              <Route path="/" element={<SmartRoot><DashboardPage /></SmartRoot>} />

              {/* Auth pages */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected app pages */}
              <Route element={<ProtectedRoute />}>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/email-import" element={<EmailImportPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/compliance" element={<CompliancePage />} />
                <Route path="/payment/callback" element={<PaymentCallbackPage />} />
              </Route>

              {/* Admin portal */}
              <Route path="/admin" element={<AdminGuard />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="errors" element={<AdminErrorsPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="announcements" element={<AdminAnnouncementsPage />} />
                <Route path="audit" element={<AdminAuditPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
