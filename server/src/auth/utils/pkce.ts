import { randomBytes, createHash } from 'crypto';

export interface PKCEChallenge {
  code_verifier: string;
  code_challenge: string;
}

export const pkceUtils = {
  generateVerifier(length: number = 128): string {
    const verifier = randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
    
    if (verifier.length < 43 || verifier.length > 128) {
      throw new Error('Code verifier must be between 43 and 128 characters');
    }

    return verifier;
  },

  generateChallenge(verifier: string): string {
    const hash = createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
  },

  generate(): PKCEChallenge {
    const code_verifier = this.generateVerifier();
    const code_challenge = this.generateChallenge(code_verifier);
    
    return {
      code_verifier,
      code_challenge,
    };
  },

  verify(verifier: string, challenge: string): boolean {
    const computedChallenge = this.generateChallenge(verifier);
    return computedChallenge === challenge;
  },
};
