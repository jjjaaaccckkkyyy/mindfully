import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export const passwordUtils = {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
