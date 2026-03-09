import { findOrCreateOAuthUser } from '../passport';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

export async function verifyGoogleCode(code: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.BASE_URL || 'http://localhost:5173'}/auth/callback/google`,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google user');
  }

  const googleUser = (await userResponse.json()) as GoogleUser;

  if (!googleUser.email) {
    throw new Error('No email found in Google profile');
  }

  return {
    id: googleUser.id,
    email: googleUser.email,
    name: googleUser.name || null,
    avatarUrl: googleUser.picture,
    accessToken,
    idToken: tokenData.id_token,
    refreshToken: tokenData.refresh_token,
  };
}

export async function handleGoogleAuth(code: string): Promise<{ user: any }> {
  const profile = await verifyGoogleCode(code);
  const user = await findOrCreateOAuthUser('google', profile.id, {
    email: profile.email,
    name: profile.name || undefined,
    avatarUrl: profile.avatarUrl,
  }, {
    accessToken: profile.accessToken,
    refreshToken: profile.refreshToken,
  });

  return { user };
}
