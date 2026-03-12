import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DashboardLayout, ProtectedRoute,
  VerificationBanner
} from "./components/layout";
import { LoginPage, OAuthCallback, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/auth";
import { SessionsPage } from "./pages/settings";
import { AgentsPage, AgentCreatePage, AgentRunPage, AgentEditPage } from "./pages/agents";
import {
  AgentCards,
  ActivityChart,
  AgentTree,
  ActivityFeed,
} from "./components/dashboard";
import { useAuth } from "./lib/hooks";

function Dashboard() {
  return (
    <div className="space-y-8">
      <VerificationBanner />
      
      <div className="animate-fade-in-up fade-in-delay-0">
        <h1 className="font-display text-4xl font-semibold tracking-wider">
          <span className="text-gradient-cyber">Dashboard</span>
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground uppercase tracking-widest">
          Monitor your agents and recent activity
        </p>
      </div>

      <div className="animate-fade-in-up fade-in-delay-1">
        <AgentCards />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up fade-in-delay-2">
          <ActivityChart />
        </div>
        <div className="animate-fade-in-up fade-in-delay-3">
          <AgentTree />
        </div>
      </div>

      <div className="animate-fade-in-up fade-in-delay-4">
        <ActivityFeed />
      </div>
    </div>
  );
}

function LoginRedirect() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return <LoginPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/settings/sessions"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SessionsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AgentsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents/new"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AgentCreatePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents/:id/run"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AgentRunPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AgentEditPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
