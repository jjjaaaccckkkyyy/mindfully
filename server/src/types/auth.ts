import { User } from '../db/repositories/users';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export type { User };
