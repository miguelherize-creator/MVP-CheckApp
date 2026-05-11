import { DocumentValidator } from './document-validator.interface';
import { RutValidator } from './rut.validator';

/**
 * Registry de validadores por código de document_type.
 * Para agregar un nuevo país: crear el validador e incluirlo aquí.
 *
 * Ejemplo futuro:
 *   DNI: new DniValidator(),        // Argentina / Colombia / Perú
 *   PASSPORT: new PassportValidator(),
 */
const VALIDATORS: Record<string, DocumentValidator> = {
  RUT: new RutValidator(),
};

export function getDocumentValidator(documentTypeCode: string): DocumentValidator | null {
  return VALIDATORS[documentTypeCode] ?? null;
}
