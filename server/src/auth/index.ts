import passport from './passport';
import { getSessionConfig } from './sessions';
import { sendEmail } from '../email';
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
} from '../email/templates';

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

export async function sendVerificationEmail(email: string, token: string, userName?: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Verify Your Email Address - Mindful',
    html: getVerificationEmailHtml(token, userName),
    text: getVerificationEmailText(token, userName),
  });
}

export async function sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Reset Your Password - Mindful',
    html: getPasswordResetEmailHtml(token, userName),
    text: getPasswordResetEmailText(token, userName),
  });
}
