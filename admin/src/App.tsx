import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import AuthGate from './components/AuthGate';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PropertiesPage from './pages/PropertiesPage';
import LeasesPage from './pages/LeasesPage';
import MaintenancePage from './pages/MaintenancePage';
import PaymentsPage from './pages/PaymentsPage';
import DevPlanePage from './pages/DevPlanePage';
import DevLogsPage from './pages/DevLogsPage';
import DevAuditPage from './pages/DevAuditPage';
import DevEnvPage from './pages/DevEnvPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGate />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="leases" element={<LeasesPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="payments" element={<PaymentsPage />} />
              {import.meta.env.DEV && (
                <Route path="dev/plane" element={<DevPlanePage />} />
              )}
              <Route path="dev/logs" element={<DevLogsPage />} />
              <Route path="dev/audit" element={<DevAuditPage />} />
              <Route path="dev/env" element={<DevEnvPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
