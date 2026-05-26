export class MockMailService {
  private verificationCodes = new Map<string, string>();
  private resetCodes = new Map<string, string>();

  async sendEmailVerificationCode(to: string, code: string): Promise<void> {
    this.verificationCodes.set(to, code);
  }

  async sendPasswordResetOtp(to: string, code: string): Promise<void> {
    this.resetCodes.set(to, code);
  }

  getVerificationCode(email: string): string | undefined {
    return this.verificationCodes.get(email);
  }

  getResetCode(email: string): string | undefined {
    return this.resetCodes.get(email);
  }

  clear(): void {
    this.verificationCodes.clear();
    this.resetCodes.clear();
  }
}
