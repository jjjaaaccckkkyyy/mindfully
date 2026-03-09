import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from '../passport';
import { findOrCreateOAuthUser } from '../passport';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const strategy = new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/google/callback`,
      scope: ['email', 'profile'],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        const user = await findOrCreateOAuthUser('google', profile.id, {
          email,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  );

  passport.use('google', strategy);
} else {
  console.warn('Google OAuth credentials not configured - Google login disabled');
}
