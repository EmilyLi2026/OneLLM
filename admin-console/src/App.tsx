import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './utils/auth';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './pages/Login';
import { JoinPage } from './pages/Join';
import { DashboardPage } from './pages/Dashboard';
import { KeysPage } from './pages/Keys';
import { AgentsPage } from './pages/Agents';
import { AgentDetailPage } from './pages/AgentDetail';
import { CostsPage } from './pages/Costs';
import { LogsPage } from './pages/Logs';
import { LogsDetailPage } from './pages/LogsDetail';
import { SettingsPage } from './pages/Settings';
import { AuditPage } from './pages/Audit';
import { ProvidersPage } from './pages/Providers';
import { ModelsPage } from './pages/Models';
import { PlaygroundPage } from './pages/Playground';
import { BudgetPage } from './pages/Budget';
import { CompliancePage } from './pages/Compliance';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="keys/test" element={<PlaygroundPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentDetailPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="logs/detail" element={<LogsDetailPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="compliance" element={<CompliancePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
