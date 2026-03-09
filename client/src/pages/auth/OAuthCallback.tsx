import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const pathParts = window.location.pathname.split("/");
      const provider = pathParts[pathParts.length - 1];

      if (!code) {
        setError("No authorization code received");
        return;
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/auth/${provider}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Authentication failed");
        }

        const data = await response.json();

        if (data.idToken) {
          localStorage.setItem("id_token", data.idToken);
        }

        navigate("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "hsl(222 47% 6%)" }}>
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-red-400">Authentication Failed</h1>
          <p className="font-mono text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="rounded border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.05)] px-6 py-2 font-mono text-sm uppercase tracking-wider text-[hsl(187_100%_70%)] hover:bg-[hsl(187_100%_50%/0.15)]"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "hsl(222 47% 6%)" }}>
      <div className="text-center space-y-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[hsl(187_100%_50%/0.3)] border-t-[hsl(187_100%_70%)]" />
        <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
          Authenticating...
        </p>
      </div>
    </div>
  );
}
