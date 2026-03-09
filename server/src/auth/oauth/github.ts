import { findOrCreateOAuthUser } from '../passport';

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export async function verifyGitHubCode(code: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string;
  accessToken: string;
}> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth not configured');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('GitHub token exchange failed:', tokenResponse.status, errorText);
    throw new Error('Failed to exchange code for token');
  }

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;

  if (tokenData.error) {
    console.error('GitHub OAuth error:', tokenData.error, tokenData.error_description);
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  const githubUser = (await userResponse.json()) as GitHubUser;

  let email: string | null = githubUser.email;

  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as GitHubEmail[];
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails.find(e => e.verified)?.email || null;
    }
  }

  if (!email) {
    throw new Error('No verified email found in GitHub profile');
  }

  return {
    id: String(githubUser.id),
    email,
    name: githubUser.name || githubUser.login,
    avatarUrl: githubUser.avatar_url,
    accessToken,
  };
}

export async function handleGitHubAuth(code: string) {
  const profile = await verifyGitHubCode(code);
  const user = await findOrCreateOAuthUser('github', profile.id, {
    email: profile.email,
    name: profile.name || undefined,
    avatarUrl: profile.avatarUrl,
  }, {
    accessToken: profile.accessToken,
  });

  return user;
}
