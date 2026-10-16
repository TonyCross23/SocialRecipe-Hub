import argon2 from 'argon2';
import type { PasswordService } from '../auth.types.js';

export class ArgonPasswordService implements PasswordService {
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.dummyHash = this.hash('dummy-password-never-used-for-login');
  }

  hash(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  verify(hash: string, password: string) {
    return argon2.verify(hash, password);
  }

  async dummyVerify(password: string) {
    await this.verify(await this.dummyHash, password);
  }
}
