export interface DocumentValidator {
  /** Valida formato y coherencia matemática del número de documento. */
  validate(value: string): boolean;
  /** Mensaje de error legible para mostrar al usuario. */
  errorMessage: string;
}
