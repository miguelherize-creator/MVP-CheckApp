export interface ClassificationRule {
  keywords: string[];
  category: string;
  subcategory: string;
  isTransfer?: boolean;
  priority: number;
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ── TRASPASOS (prioridad máxima) ──────────────────────────────────────────
  { keywords: ['traspaso a', 'transf a', 'transf.', 'transferencia', 'khipu'], category: 'Traspasos', subcategory: 'Entre cuentas', isTransfer: true, priority: 100 },

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  { keywords: ['abono ventas getnet', 'getnet'], category: 'Ingresos', subcategory: 'Ventas', priority: 90 },
  { keywords: ['depósito en efectivo', 'deposito en efectivo'], category: 'Ingresos', subcategory: 'Depósito efectivo', priority: 90 },
  { keywords: ['abono conforme ley', 'reverso compra', 'dev.'], category: 'Ingresos', subcategory: 'Devoluciones', priority: 90 },

  // ── CRÉDITOS / DEUDAS ─────────────────────────────────────────────────────
  { keywords: ['pago cuota crédito', 'pago cuota credito', 'cuota crédito'], category: 'Créditos', subcategory: 'Crédito bancario', priority: 80 },
  { keywords: ['pago en linea creccu', 'creccu'], category: 'Créditos', subcategory: 'Cooperativa', priority: 80 },
  { keywords: ['com.mantencion plan', 'mantencion plan'], category: 'Créditos', subcategory: 'Comisiones bancarias', priority: 80 },
  { keywords: ['pac santander'], category: 'Créditos', subcategory: 'PAC', priority: 80 },

  // ── SEGUROS ───────────────────────────────────────────────────────────────
  { keywords: ['metlife'], category: 'Seguros', subcategory: 'Seguro de vida', priority: 75 },
  { keywords: ['consorcio ind de ali', 'consorcio'], category: 'Seguros', subcategory: 'Seguro general', priority: 75 },

  // ── HOGAR / SERVICIOS ─────────────────────────────────────────────────────
  { keywords: ['pago en linea servipag', 'servipag'], category: 'Hogar', subcategory: 'Servicios básicos', priority: 70 },
  { keywords: ['starlink', 'dl*starlink'], category: 'Hogar', subcategory: 'Internet', priority: 70 },
  { keywords: ['tejuelas', 'sodimac', 'casa ideas', 'ursol ltda'], category: 'Hogar', subcategory: 'Mejoras del hogar', priority: 70 },
  { keywords: ['nueva agua', 'mao nueva agua'], category: 'Hogar', subcategory: 'Agua', priority: 70 },
  { keywords: ['apr captacion'], category: 'Hogar', subcategory: 'Agua APR', priority: 70 },
  { keywords: ['soc de recauda'], category: 'Hogar', subcategory: 'Servicios básicos', priority: 70 },

  // ── ALIMENTACIÓN ──────────────────────────────────────────────────────────
  { keywords: ['jumbo', 'central mayorista', 'supermercados ori', 'superm.eltit', 'palumbo jumbo'], category: 'Alimentación', subcategory: 'Supermercado', priority: 70 },
  { keywords: ['sociedad cafe', 'sociedad café'], category: 'Alimentación', subcategory: 'Café / desayuno', priority: 70 },
  { keywords: ['fuente de soda', 'agusbel', 'asi tal cual', 'express villarric', 'villarrica 1'], category: 'Alimentación', subcategory: 'Restorán / comida', priority: 70 },

  // ── PROVEEDORES ───────────────────────────────────────────────────────────
  { keywords: ['proveedor coca', '093281000k'], category: 'Proveedores', subcategory: 'Coca-Cola', priority: 75 },
  { keywords: ['proveedor nest', '0907030008'], category: 'Proveedores', subcategory: 'Nestlé', priority: 75 },
  { keywords: ['proveedor dima', '0788095600'], category: 'Proveedores', subcategory: 'Dima', priority: 75 },
  { keywords: ['bat chile'], category: 'Proveedores', subcategory: 'BAT Chile', priority: 75 },
  { keywords: ['proveedor ccu', '0798627503'], category: 'Proveedores', subcategory: 'CCU', priority: 75 },
  { keywords: ['proveedor alle', '0777840002'], category: 'Proveedores', subcategory: 'Alle', priority: 75 },
  { keywords: ['ideal s.a.', '0826235004', 'ideal joaquin', '0142558696'], category: 'Proveedores', subcategory: 'Ideal', priority: 75 },
  { keywords: ['quesos sergio', '0112468625'], category: 'Proveedores', subcategory: 'Quesos', priority: 75 },
  { keywords: ['colun', '0810941006'], category: 'Proveedores', subcategory: 'Colun', priority: 75 },
  { keywords: ['longa2 comerci', '0771063349'], category: 'Proveedores', subcategory: 'Longa2', priority: 75 },
  { keywords: ['wallmart centr', 'walmart'], category: 'Proveedores', subcategory: 'Walmart', priority: 75 },
  { keywords: ['productos fernandez'], category: 'Proveedores', subcategory: 'Fernández', priority: 75 },
  { keywords: ['coseche spa', '0911390000'], category: 'Proveedores', subcategory: 'Coseche', priority: 75 },

  // ── MOVILIZACIÓN ──────────────────────────────────────────────────────────
  { keywords: ['uber', 'payu *uber', 'uber *trip'], category: 'Movilización', subcategory: 'Rideshare', priority: 70 },
  { keywords: ['pasajebus', 'adm terminal buse'], category: 'Movilización', subcategory: 'Bus / Pasajes', priority: 70 },
  { keywords: ['copec', 'combustible'], category: 'Movilización', subcategory: 'Combustible', priority: 70 },

  // ── ENTRETENIMIENTO ───────────────────────────────────────────────────────
  { keywords: ['netflix', 'paramount+', 'zapping chile'], category: 'Entretenimiento', subcategory: 'Streaming', priority: 70 },
  { keywords: ['fantasilandia', 'mercadopago *fant'], category: 'Entretenimiento', subcategory: 'Parques / atracciones', priority: 70 },
  { keywords: ['space zone', 'botes chocadores', 'castillo encantad'], category: 'Entretenimiento', subcategory: 'Actividades recreativas', priority: 70 },
  { keywords: ['casino marina'], category: 'Entretenimiento', subcategory: 'Casino', priority: 70 },
  { keywords: ['derby'], category: 'Entretenimiento', subcategory: 'Bar / Pub', priority: 65 },

  // ── VIAJES ────────────────────────────────────────────────────────────────
  { keywords: ['hotel city expres', 'hotel'], category: 'Viajes', subcategory: 'Alojamiento', priority: 70 },
  { keywords: ['jetsmartairli', 'jetsmart'], category: 'Viajes', subcategory: 'Vuelos', priority: 70 },

  // ── GASTOS PERSONALES ─────────────────────────────────────────────────────
  { keywords: ['h&m mall', 'falabella', 'tommy hilfiger', 'nvs concepcion', 'bold', 'ferracini plaza'], category: 'Gastos_Personales', subcategory: 'Vestuario', priority: 70 },
  { keywords: ['arcadia spa'], category: 'Gastos_Personales', subcategory: 'Belleza / Spa', priority: 65 },
  { keywords: ['yerty peluquer'], category: 'Gastos_Personales', subcategory: 'Peluquería', priority: 65 },

  // ── SERVICIOS PROFESIONALES / IMPUESTOS ───────────────────────────────────
  { keywords: ['contador carlo', '0187194199', '0783477998'], category: 'Servicios profesionales', subcategory: 'Contador', priority: 75 },
  { keywords: ['previred'], category: 'Laboral', subcategory: 'Previsión', priority: 75 },
  { keywords: ['s.i.i.', 'pago en linea s.i.i'], category: 'Impuestos', subcategory: 'SII', priority: 80 },
  { keywords: ['municipalidad vil'], category: 'Impuestos', subcategory: 'Municipalidad', priority: 75 },

  // ── INVERSIONES ───────────────────────────────────────────────────────────
  { keywords: ['prex leo', '0137620162'], category: 'Inversiones', subcategory: 'Inversión / Ahorro', priority: 75 },

  // ── FAMILIA ───────────────────────────────────────────────────────────────
  { keywords: ['transf a nicol', '0211964146'], category: 'Familia', subcategory: 'Transferencia familiar', priority: 70 },

  // ── OTROS (fallback) ──────────────────────────────────────────────────────
  { keywords: ['mercadopago', 'merpago'], category: 'Otros', subcategory: 'MercadoPago', priority: 50 },
  { keywords: ['chilexpress'], category: 'Otros', subcategory: 'Envíos / Courier', priority: 65 },
  { keywords: ['pago en linea'], category: 'Otros', subcategory: 'Pago en línea', priority: 10 },
];

export const ANT_EXPENSE_MAX_AMOUNT = 16_000;

export const ANT_EXPENSE_EXCLUDED_SUBCATEGORIES = [
  'Entre cuentas', 'Crédito bancario', 'Cooperativa', 'PAC',
  'Previsión', 'SII', 'Municipalidad', 'Ventas', 'Depósito efectivo',
];
