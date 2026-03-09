import passport from 'passport';
import { User, usersRepository } from '../db/repositories/users';
import { oauthAccountRepository } from '../db/repositories/oauth';

// Serialize user to store in session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await usersRepository.findById(id);
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error, null);
  }
});

// Helper to find or create OAuth user
async function findOrCreateOAuthUser(
  provider: string,
  providerUserId: string,
  profile: {
    email: string;
    name?: string;
    avatarUrl?: string;
  }
): Promise<User> {
  // Check if OAuth account exists
  const existingOAuthAccount = await oauthAccountRepository.findByProviderAndId(
    provider,
    providerUserId
  );

  if (existingOAuthAccount) {
    // Get existing user
    const user = await usersRepository.findById(existingOAuthAccount.user_id);
    if (!user) {
      throw new Error('User not found for existing OAuth account');
    }
    return user;
  }

  // Check if user with email exists
  let user = await usersRepository.findByEmail(profile.email);

  if (!user) {
    // Create new user
    user = await usersRepository.create({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      emailVerified: true, // OAuth providers verify email
    });
  }

  // Link OAuth account to user
  await oauthAccountRepository.create({
    userId: user.id,
    provider,
    providerUserId,
  });

  return user;
}

export { findOrCreateOAuthUser };
export default passport;
