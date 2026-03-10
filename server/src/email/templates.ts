const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export interface EmailTemplateData {
  verificationLink?: string;
  resetLink?: string;
  userName?: string;
}

export function getVerificationEmailHtml(token: string, userName?: string): string {
  const verificationLink = `${BASE_URL}/auth/verify-email?token=${token}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Mindful</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a12; font-family: 'Space Mono', monospace, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #0f0f1a; border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 8px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: 0.1em; background: linear-gradient(135deg, #00e5ff 0%, #00b8d4 50%, #ff00ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                MINDFUL
              </h1>
              <p style="margin: 10px 0 0 0; color: #00e5ff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
                Multi-Agent AI Platform
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Verify Your Email Address
              </h2>
              ${userName ? `<p style="margin: 0 0 20px 0; color: #b0b0c0; font-size: 16px;">Hello ${userName},</p>` : ''}
              <p style="margin: 0 0 30px 0; color: #b0b0c0; font-size: 16px; line-height: 1.6;">
                Thank you for registering with Mindful. Please verify your email address by clicking the button below:
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #00e5ff 0%, #00b8d4 100%); border-radius: 6px;">
                    <a href="${verificationLink}" style="display: inline-block; padding: 16px 32px; color: #0a0a12; text-decoration: none; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #808090; font-size: 14px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #00e5ff; font-size: 14px; word-break: break-all;">
                ${verificationLink}
              </p>
              
              <p style="margin: 30px 0 0 0; color: #808090; font-size: 14px;">
                This link will expire in 24 hours.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(0, 229, 255, 0.1);">
              <p style="margin: 0; color: #606070; font-size: 12px; text-align: center;">
                If you didn't create an account with Mindful, please ignore this email.
              </p>
              <p style="margin: 10px 0 0 0; color: #606070; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Mindful. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getVerificationEmailText(token: string, userName?: string): string {
  const verificationLink = `${BASE_URL}/auth/verify-email?token=${token}`;
  
  return `
MINDFUL - Multi-Agent AI Platform

Verify Your Email Address

${userName ? `Hello ${userName},\n\n` : ''}
Thank you for registering with Mindful. Please verify your email address by visiting the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with Mindful, please ignore this email.

© ${new Date().getFullYear()} Mindful. All rights reserved.
  `.trim();
}

export function getPasswordResetEmailHtml(token: string, userName?: string): string {
  const resetLink = `${BASE_URL}/reset-password?token=${token}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Mindful</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a12; font-family: 'Space Mono', monospace, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #0f0f1a; border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 8px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: 0.1em; background: linear-gradient(135deg, #00e5ff 0%, #00b8d4 50%, #ff00ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                MINDFUL
              </h1>
              <p style="margin: 10px 0 0 0; color: #00e5ff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
                Multi-Agent AI Platform
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Reset Your Password
              </h2>
              ${userName ? `<p style="margin: 0 0 20px 0; color: #b0b0c0; font-size: 16px;">Hello ${userName},</p>` : ''}
              <p style="margin: 0 0 30px 0; color: #b0b0c0; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #00e5ff 0%, #00b8d4 100%); border-radius: 6px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 32px; color: #0a0a12; text-decoration: none; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #808090; font-size: 14px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: #00e5ff; font-size: 14px; word-break: break-all;">
                ${resetLink}
              </p>
              
              <p style="margin: 30px 0 0 0; color: #808090; font-size: 14px;">
                This link will expire in 1 hour.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(0, 229, 255, 0.1);">
              <p style="margin: 0; color: #606070; font-size: 12px; text-align: center;">
                If you didn't request a password reset, please ignore this email.
              </p>
              <p style="margin: 10px 0 0 0; color: #606070; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Mindful. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getPasswordResetEmailText(token: string, userName?: string): string {
  const resetLink = `${BASE_URL}/reset-password?token=${token}`;
  
  return `
MINDFUL - Multi-Agent AI Platform

Reset Your Password

${userName ? `Hello ${userName},\n\n` : ''}
We received a request to reset your password. Please visit the link below to create a new password:

${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

© ${new Date().getFullYear()} Mindful. All rights reserved.
  `.trim();
}
