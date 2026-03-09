import passport from './passport';
import { getSessionConfig } from './sessions';
import { ConsoleEmailService } from '../email/console';

import './strategies/github';
import './strategies/google';
import './strategies/local';

export { passport };
export { getSessionConfig };
export { requireAuth, optionalAuth, requireEmailVerified, requireRole } from './middleware';
export { passwordUtils } from './utils/password';
export { tokenUtils } from './utils/tokens';
export { pkceUtils } from './utils/pkce';
export { findOrCreateOAuthUser } from './passport';
export { generateIdToken, verifyIdToken } from './utils/id-token';

// Email service
const emailService = new ConsoleEmailService();

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;
  
  await emailService.send({
    to: email,
    subject: 'Verify Your Email Address',
    text: `Please verify your email by visiting: ${verificationUrl}`,
    html: `
      <h1>Verify Your Email</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
  
  await emailService.send({
    to: email,
    subject: 'Reset Your Password',
    text: `Reset your password by visiting: ${resetUrl}`,
    html: `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
