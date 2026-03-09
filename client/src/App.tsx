import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/layout";
import { LoginPage, OAuthCallback } from "./pages/auth";
import {
  AgentCards,
  ActivityChart,
  AgentTree,
  ActivityFeed,
} from "./components/dashboard";

function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <h1 className="font-display text-4xl font-semibold tracking-wider">
          <span className="text-gradient-cyber">Dashboard</span>
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground uppercase tracking-widest">
          Monitor your agents and recent activity
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <AgentCards />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <ActivityChart />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <AgentTree />
        </div>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
        <ActivityFeed />
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        <Route
          path="/"
          element={
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
