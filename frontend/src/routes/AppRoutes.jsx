import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/layout/AppLayout";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ChatPage from "../pages/ChatPage";
import MyActivityPage from "../pages/MyActivityPage";
import DocumentsPage from "../pages/DocumentsPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";
import IncidentsPage from "../pages/IncidentsPage";
import ApprovalsPage from "../pages/ApprovalsPage";
import AuditLogsPage from "../pages/AuditLogsPage";
import PoliciesPage from "../pages/PoliciesPage";
import UsersPage from "../pages/UsersPage";
import EvaluationPage from "../pages/EvaluationPage";
import PromptLogPage from "../pages/PromptLogPage";
import { homeFor } from "../utils/routing";

function RequireAuth({ children, roles }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.some((r) => user?.roles?.includes(r))) {
    return <Navigate to={homeFor(user?.roles)} replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={homeFor(user?.roles)} replace /> : children;
}

const MONITOR = ["ADMIN", "SECURITY_ANALYST"];

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/assistant" element={<ChatPage />} />
        <Route path="/activity" element={<MyActivityPage />} />
        <Route path="/documents" element={<DocumentsPage />} />

        <Route path="/admin" element={<RequireAuth roles={MONITOR}><AdminDashboardPage /></RequireAuth>} />
        <Route path="/admin/prompts" element={<RequireAuth roles={MONITOR}><PromptLogPage /></RequireAuth>} />
        <Route path="/admin/incidents" element={<RequireAuth roles={MONITOR}><IncidentsPage /></RequireAuth>} />
        <Route path="/admin/approvals" element={<RequireAuth roles={MONITOR}><ApprovalsPage /></RequireAuth>} />
        <Route path="/admin/audit" element={<RequireAuth roles={MONITOR}><AuditLogsPage /></RequireAuth>} />
        <Route path="/admin/policies" element={<RequireAuth roles={MONITOR}><PoliciesPage /></RequireAuth>} />
        <Route path="/admin/evaluation" element={<RequireAuth roles={MONITOR}><EvaluationPage /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth roles={["ADMIN"]}><UsersPage /></RequireAuth>} />
      </Route>

      {/* Old paths from the first version */}
      <Route path="/dashboard" element={<Navigate to="/assistant" replace />} />
      <Route path="/security" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
