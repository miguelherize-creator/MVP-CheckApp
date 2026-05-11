export enum CategorizationStatus {
  /** Clasificado correctamente — no requiere acción del usuario. */
  CATEGORIZED = 'categorized',

  /** Importado desde cartola con baja confianza — el usuario debe revisar. */
  PENDING_REVIEW = 'pending_review',

  /** Creado manualmente sin categoría asignada — estado neutral. */
  UNCATEGORIZED = 'uncategorized',
}
