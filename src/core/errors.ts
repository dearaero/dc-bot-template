/** Kullanıcıya gösterilmesi güvenli, beklenen iş kuralı hatası. */
export class UserError extends Error {
  readonly code: string;

  constructor(message: string, code = 'USER_ERROR', options?: ErrorOptions) {
    super(message, options);
    this.name = 'UserError';
    this.code = code;
  }
}

export class ConfigurationError extends Error {
  constructor(problems: readonly string[]) {
    super(`Yapılandırma geçersiz:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
    this.name = 'ConfigurationError';
  }
}
