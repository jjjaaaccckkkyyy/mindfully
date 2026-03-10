import { useState, useEffect, useCallback } from "react";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setIdToken: (token: string | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const ID_TOKEN_KEY = "id_token";

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const setIdToken = useCallback((token: string | null) => {
    if (token) {
      localStorage.setItem(ID_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ID_TOKEN_KEY);
    }
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem(ID_TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    setIdToken,
    logout,
    refreshUser,
  };
}

export function getIdToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(ID_TOKEN_KEY);
  }
  return null;
}

export function decodeIdToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      emailVerified: payload.emailVerified,
    };
  } catch {
    return null;
  }
}
