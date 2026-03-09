import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import passport from '../auth/passport';
import { usersRepository } from '../db/repositories/users';
import { verificationTokenRepository, passwordResetTokenRepository } from '../db/repositories/tokens';
import { passwordUtils } from '../auth/utils/password';
import { tokenUtils } from '../auth/utils/tokens';
import { sendVerificationEmail, sendPasswordResetEmail, generateIdToken } from '../auth';
import { requireAuth } from '../auth/middleware';
import { handleGitHubAuth } from '../auth/oauth/github';
import { handleGoogleAuth } from '../auth/oauth/google';
import { z } from 'zod';

const router: RouterType = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const oauthVerifySchema = z.object({
  code: z.string(),
});

router.post('/github/verify', async (req: Request, res: Response) => {
  try {
    const validation = oauthVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const user = await handleGitHubAuth(validation.data.code);

    (req as any).logIn(user, (err: any) => {
      if (err) {
        return res.status(500).json({
          error: 'Login failed',
          message: 'Failed to establish session',
        });
      }

      const idToken = generateIdToken(user, 'github');

      return res.json({
        message: 'GitHub authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          emailVerified: user.email_verified,
        },
        idToken,
      });
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'GitHub authentication failed',
    });
  }
});

router.post('/google/verify', async (req: Request, res: Response) => {
  try {
    const validation = oauthVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { user } = await handleGoogleAuth(validation.data.code);

    (req as any).logIn(user, (err: any) => {
      if (err) {
        return res.status(500).json({
          error: 'Login failed',
          message: 'Failed to establish session',
        });
      }

      const idToken = generateIdToken(user, 'google');

      return res.json({
        message: 'Google authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          emailVerified: user.email_verified,
        },
        idToken,
      });
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Google authentication failed',
    });
  }
});

// Registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await usersRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Validate password strength
    const passwordValidation = passwordUtils.validate(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Invalid password',
        details: passwordValidation.errors,
      });
    }

    // Create user
    const passwordHash = await passwordUtils.hash(password);
    const user = await usersRepository.create({
      email,
      passwordHash,
      name,
      emailVerified: false,
    });

    // Generate verification token
    const token = tokenUtils.generateVerificationToken();
    const expiresAt = tokenUtils.generateExpiry(24); // 24 hours
    await verificationTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    // Send verification email
    await sendVerificationEmail(user.email, token);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration',
    });
  }
});

// Login
router.post('/login', (req: Request, res: Response, next) => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.errors,
    });
  }

  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({
        error: 'Login failed',
        message: 'An error occurred during login',
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: info?.message || 'Invalid credentials',
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({
          error: 'Login failed',
          message: 'Failed to establish session',
        });
      }

      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          emailVerified: user.email_verified,
        },
      });
    });
  })(req, res, next);
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        error: 'Logout failed',
        message: 'An error occurred during logout',
      });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Verify email
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Verification token is required',
      });
    }

    const verificationToken = await verificationTokenRepository.findByToken(token);

    if (!verificationToken) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'This verification link is invalid',
      });
    }

    if (new Date() > verificationToken.expires_at) {
      await verificationTokenRepository.delete(token);
      return res.status(400).json({
        error: 'Token expired',
        message: 'This verification link has expired. Please request a new one.',
      });
    }

    // Mark email as verified
    await usersRepository.update(verificationToken.user_id, {
      emailVerified: true,
    });

    // Delete the token
    await verificationTokenRepository.delete(token);

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: 'An error occurred during email verification',
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Please provide your email address',
      });
    }

    const user = await usersRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If an account exists with this email, a verification email has been sent.',
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This email is already verified',
      });
    }

    // Delete old tokens
    await verificationTokenRepository.deleteByUserId(user.id);

    // Generate new token
    const token = tokenUtils.generateVerificationToken();
    const expiresAt = tokenUtils.generateExpiry(24);
    await verificationTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    await sendVerificationEmail(user.email, token);

    res.json({
      message: 'If an account exists with this email, a verification email has been sent.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Failed to resend',
      message: 'An error occurred',
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email } = validation.data;
    const user = await usersRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If an account exists with this email, a password reset email has been sent.',
      });
    }

    // Delete old tokens
    await passwordResetTokenRepository.deleteByUserId(user.id);

    // Generate new token
    const token = tokenUtils.generatePasswordResetToken();
    const expiresAt = tokenUtils.generateExpiry(1); // 1 hour
    await passwordResetTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, token);

    res.json({
      message: 'If an account exists with this email, a password reset email has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Failed',
      message: 'An error occurred',
    });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { token, password } = validation.data;

    const resetToken = await passwordResetTokenRepository.findByToken(token);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'This reset link is invalid',
      });
    }

    if (new Date() > resetToken.expires_at) {
      await passwordResetTokenRepository.delete(token);
      return res.status(400).json({
        error: 'Token expired',
        message: 'This reset link has expired',
      });
    }

    // Validate password
    const passwordValidation = passwordUtils.validate(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Invalid password',
        details: passwordValidation.errors,
      });
    }

    // Update password
    const passwordHash = await passwordUtils.hash(password);
    await usersRepository.update(resetToken.user_id, { passwordHash });

    // Delete token
    await passwordResetTokenRepository.delete(token);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed',
      message: 'An error occurred',
    });
  }
});

// Get current user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
    },
  });
});

export default router;
