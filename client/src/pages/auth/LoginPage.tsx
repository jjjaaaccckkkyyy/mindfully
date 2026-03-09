import { useState } from "react";
import { Github } from "lucide-react";

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = () => {
    setIsLoading(true);
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback/github`;
    const scope = "user:email";

    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

    window.location.href = githubUrl;
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const scope = "email profile";

    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    window.location.href = googleUrl;
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "hsl(222 47% 6%)" }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-widest text-gradient-cyber">
            Mindful
          </h1>
          <p className="mt-4 font-mono text-sm text-muted-foreground uppercase tracking-wider">
            Multi-Agent AI Platform
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-[hsl(187_100%_50%/0.2)] bg-[hsl(222_47%_10%)] p-8" style={{ boxShadow: "0 0 30px hsl(187 100% 50% / 0.1)" }}>
          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.05)] px-6 py-3 font-mono text-sm uppercase tracking-wider text-[hsl(187_100%_70%)] transition-all duration-300 hover:border-[hsl(187_100%_50%/0.6)] hover:bg-[hsl(187_100%_50%/0.15)] disabled:opacity-50"
          >
            <Github className="h-5 w-5" />
            {isLoading ? "Connecting..." : "Sign in with GitHub"}
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded border border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.05)] px-6 py-3 font-mono text-sm uppercase tracking-wider text-[hsl(187_100%_70%)] transition-all duration-300 hover:border-[hsl(187_100%_50%/0.6)] hover:bg-[hsl(187_100%_50%/0.15)] disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLoading ? "Connecting..." : "Sign in with Google"}
          </button>
        </div>

        <p className="text-center font-mono text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
