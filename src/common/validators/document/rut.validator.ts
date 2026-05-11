import { DocumentValidator } from './document-validator.interface';

/**
 * Validador de RUT chileno.
 * Formato aceptado: XXXXXXXX-V  (7–8 dígitos, guión, dígito verificador 0-9 o K).
 * Algoritmo: Módulo 11.
 */
export class RutValidator implements DocumentValidator {
  readonly errorMessage = 'RUT inválido. Formato esperado: 12345678-5';

  validate(raw: string): boolean {
    const normalized = raw.trim().toUpperCase().replace(/\./g, '');
    const match = normalized.match(/^(\d{7,8})-([0-9K])$/);
    if (!match) return false;
    return this.computeCheckDigit(match[1]) === match[2];
  }

  private computeCheckDigit(body: string): string {
    const digits = body.split('').reverse().map(Number);
    const multipliers = [2, 3, 4, 5, 6, 7];
    const sum = digits.reduce(
      (acc, d, i) => acc + d * multipliers[i % multipliers.length],
      0,
    );
    const remainder = 11 - (sum % 11);
    if (remainder === 11) return '0';
    if (remainder === 10) return 'K';
    return String(remainder);
  }
}
