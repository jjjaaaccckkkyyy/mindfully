import { randomBytes } from 'crypto';

export const tokenUtils = {
  generate(length: number = 32): string {
    return randomBytes(length).toString('hex');
  },

  generateVerificationToken(): string {
    return this.generate(32);
  },

  generatePasswordResetToken(): string {
    return this.generate(32);
  },

  generateExpiry(hours: number = 24): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);
    return expiresAt;
  },
};
