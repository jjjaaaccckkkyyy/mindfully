import { useState } from "react";
import { AlertCircle, Mail, X } from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";

export function VerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!user || user.emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    if (resending) return;
    
    setResending(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: user.email }),
      });
      
      if (response.ok) {
        setResent(true);
        setTimeout(() => setResent(false), 5000);
      }
    } catch (error) {
      console.error("Failed to resend verification:", error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-400">Email not verified</p>
          <p className="text-xs text-amber-400/70">
            Please verify your email to access all features
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="flex items-center gap-1.5 rounded-md bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-400/30 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          {resent ? "Sent!" : resending ? "Sending..." : "Resend email"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-amber-400/50 transition-colors hover:text-amber-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
