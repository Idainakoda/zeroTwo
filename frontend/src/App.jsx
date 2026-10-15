
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDashboard from "./pages/AdminDashboardPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles &&
    !allowedRoles.some((role) => user?.roles?.includes(role))
  ) {
    // Send users to the dashboard appropriate for their role.
    if (user?.roles?.includes("ADMIN")) {
      return <Navigate to="/admin" replace />;
    }

    if (user?.roles?.includes("SECURITY_ANALYST")) {
      return <Navigate to="/security" replace />;
    }

    if (user?.roles?.includes("EMPLOYEE")) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* Employee dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Security analyst dashboard */}
        <Route
          path="/security"
          element={
            <ProtectedRoute allowedRoles={["SECURITY_ANALYST"]}>
              <div className="min-h-screen bg-slate-950 p-8 text-white">
                <h1 className="text-2xl font-bold">
                  Security Analyst Dashboard
                </h1>
                <p className="mt-3 text-slate-400">
                  Your security dashboard is coming soon.
                </p>
              </div>
            </ProtectedRoute>
          }
        />

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
