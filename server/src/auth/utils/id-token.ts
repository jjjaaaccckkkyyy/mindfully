import jwt from 'jsonwebtoken';

interface IdTokenPayload {
  sub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  provider: string;
}

export function generateIdToken(user: {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
}, provider: string): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be set');
  }

  const payload: IdTokenPayload & {
    iss: string;
    aud: string;
    exp: number;
    iat: number;
  } = {
    iss: process.env.BASE_URL || 'http://localhost:3000',
    sub: user.id,
    aud: 'mindful-app',
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified,
    provider,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60),
  };

  return jwt.sign(payload, secret);
}

export function verifyIdToken(token: string): IdTokenPayload | null {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  
  if (!secret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as IdTokenPayload & {
      iss: string;
      aud: string;
    };
    
    if (decoded.aud !== 'mindful-app') {
      return null;
    }
    
    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      avatarUrl: decoded.avatarUrl,
      emailVerified: decoded.emailVerified,
      provider: decoded.provider,
    };
  } catch {
    return null;
  }
}
