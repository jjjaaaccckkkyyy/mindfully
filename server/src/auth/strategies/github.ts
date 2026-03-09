import { Strategy as GitHubStrategy } from 'passport-github2';
import passport from '../passport';
import { findOrCreateOAuthUser } from '../passport';

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  const strategy = new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/github/callback`,
      scope: ['user:email'],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in GitHub profile'), null);
        }

        const user = await findOrCreateOAuthUser('github', profile.id, {
          email,
          name: profile.displayName || profile.username,
          avatarUrl: profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  );

  passport.use('github', strategy);
} else {
  console.warn('GitHub OAuth credentials not configured - GitHub login disabled');
}
