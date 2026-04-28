/**
 * classification-rules.data.ts
 *
 * Catálogo de reglas de categorización por keyword en glosa bancaria.
 * Basado en el Excel CashFlow de Mentoría en Finanzas Personales.
 *
 * Estructura:
 *   keywords  → palabras o frases a buscar en la descripción (case-insensitive)
 *   category  → categoría del catálogo
 *   subcategory → subcategoría del catálogo
 *   isTransfer → true si es traspaso entre cuentas (se excluye de métricas de gasto)
 *   priority   → número mayor = se evalúa primero (para evitar conflictos)
 */

export interface ClassificationRule {
  keywords: string[];
  category: string;
  subcategory: string;
  isTransfer?: boolean;
  priority: number;
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [

  // ── TRASPASOS ENTRE CUENTAS (prioridad máxima — excluir de métricas) ──────
  {
    keywords: ['traspaso a', 'transf a', 'transf.', 'transferencia', 'khipu'],
    category: 'Traspasos',
    subcategory: 'Entre cuentas',
    isTransfer: true,
    priority: 100,
  },

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  {
    keywords: ['abono ventas getnet', 'getnet'],
    category: 'Ingresos',
    subcategory: 'Ventas',
    priority: 90,
  },
  {
    keywords: ['depósito en efectivo', 'deposito en efectivo'],
    category: 'Ingresos',
    subcategory: 'Depósito efectivo',
    priority: 90,
  },
  {
    keywords: ['abono conforme ley', 'reverso compra', 'dev.'],
    category: 'Ingresos',
    subcategory: 'Devoluciones',
    priority: 90,
  },

  // ── CRÉDITOS / DEUDAS ─────────────────────────────────────────────────────
  {
    keywords: ['pago cuota crédito', 'pago cuota credito', 'cuota crédito'],
    category: 'Créditos',
    subcategory: 'Crédito bancario',
    priority: 80,
  },
  {
    keywords: ['pago en linea creccu', 'creccu'],
    category: 'Créditos',
    subcategory: 'Cooperativa',
    priority: 80,
  },
  {
    keywords: ['com.mantencion plan', 'mantencion plan'],
    category: 'Créditos',
    subcategory: 'Comisiones bancarias',
    priority: 80,
  },
  {
    keywords: ['pac santander'],
    category: 'Créditos',
    subcategory: 'PAC',
    priority: 80,
  },

  // ── SEGUROS ───────────────────────────────────────────────────────────────
  {
    keywords: ['metlife'],
    category: 'Seguros',
    subcategory: 'Seguro de vida',
    priority: 75,
  },
  {
    keywords: ['consorcio ind de ali', 'consorcio'],
    category: 'Seguros',
    subcategory: 'Seguro general',
    priority: 75,
  },

  // ── SERVICIOS BÁSICOS / HOGAR ─────────────────────────────────────────────
  {
    keywords: ['pago en linea servipag', 'servipag'],
    category: 'Hogar',
    subcategory: 'Servicios básicos',
    priority: 70,
  },
  {
    keywords: ['starlink', 'dl*starlink'],
    category: 'Hogar',
    subcategory: 'Internet',
    priority: 70,
  },
  {
    keywords: ['tejuelas', 'sodimac', 'casa ideas', 'ursol ltda'],
    category: 'Hogar',
    subcategory: 'Mejoras del hogar',
    priority: 70,
  },

  // ── ALIMENTACIÓN ──────────────────────────────────────────────────────────
  {
    keywords: ['jumbo', 'central mayorista', 'supermercados ori', 'superm.eltit', 'palumbo jumbo'],
    category: 'Alimentación',
    subcategory: 'Supermercado',
    priority: 70,
  },
  {
    keywords: ['sociedad cafe', 'sociedad café', 'cafe ', 'café '],
    category: 'Alimentación',
    subcategory: 'Café / desayuno',
    priority: 70,
  },
  {
    keywords: ['fuente de soda', 'agusbel', 'asi tal cual', 'express villarric', 'villarrica 1'],
    category: 'Alimentación',
    subcategory: 'Restorán / comida',
    priority: 70,
  },
  {
    keywords: ['fini pulpo'],
    category: 'Alimentación',
    subcategory: 'Snacks',
    priority: 65,
  },

  // ── PROVEEDORES (negocio) ─────────────────────────────────────────────────
  {
    keywords: ['proveedor coca', '093281000k'],
    category: 'Proveedores',
    subcategory: 'Bebidas / Coca-Cola',
    priority: 75,
  },
  {
    keywords: ['proveedor nest', '0907030008'],
    category: 'Proveedores',
    subcategory: 'Nestlé',
    priority: 75,
  },
  {
    keywords: ['proveedor dima', '0788095600'],
    category: 'Proveedores',
    subcategory: 'Dima',
    priority: 75,
  },
  {
    keywords: ['bat chile', 'bat chile s.a.'],
    category: 'Proveedores',
    subcategory: 'BAT Chile',
    priority: 75,
  },
  {
    keywords: ['proveedor ccu', '0798627503'],
    category: 'Proveedores',
    subcategory: 'CCU',
    priority: 75,
  },
  {
    keywords: ['proveedor alle', '0777840002'],
    category: 'Proveedores',
    subcategory: 'Proveedor Alle',
    priority: 75,
  },
  {
    keywords: ['proveedor nork', '0764841069'],
    category: 'Proveedores',
    subcategory: 'Proveedor Nork',
    priority: 75,
  },
  {
    keywords: ['productos fernandez', 'pago en linea productos fernandez'],
    category: 'Proveedores',
    subcategory: 'Fernández',
    priority: 75,
  },
  {
    keywords: ['ideal s.a.', '0826235004', 'ideal joaquin', '0142558696'],
    category: 'Proveedores',
    subcategory: 'Ideal',
    priority: 75,
  },
  {
    keywords: ['quesos sergio', '0112468625'],
    category: 'Proveedores',
    subcategory: 'Quesos',
    priority: 75,
  },
  {
    keywords: ['colun', '0810941006'],
    category: 'Proveedores',
    subcategory: 'Colun',
    priority: 75,
  },
  {
    keywords: ['longa2 comerci', '0771063349'],
    category: 'Proveedores',
    subcategory: 'Longa2',
    priority: 75,
  },
  {
    keywords: ['wallmart centr', 'walmart'],
    category: 'Proveedores',
    subcategory: 'Walmart',
    priority: 75,
  },
  {
    keywords: ['hielo nicolas', '0766022936'],
    category: 'Proveedores',
    subcategory: 'Hielo',
    priority: 75,
  },
  {
    keywords: ['cia. molinera vil', 'molinera'],
    category: 'Proveedores',
    subcategory: 'Molinera',
    priority: 75,
  },
  {
    keywords: ['coseche spa', '0911390000'],
    category: 'Proveedores',
    subcategory: 'Coseche',
    priority: 75,
  },
  {
    keywords: ['comercial peum', '0850379009'],
    category: 'Proveedores',
    subcategory: 'Comercial Peum',
    priority: 75,
  },
  {
    keywords: ['icb', '093178000k'],
    category: 'Proveedores',
    subcategory: 'ICB',
    priority: 75,
  },
  {
    keywords: ['daos spa', '0771201512'],
    category: 'Proveedores',
    subcategory: 'Daos',
    priority: 75,
  },
  {
    keywords: ['dicam spa', '0780056266'],
    category: 'Proveedores',
    subcategory: 'Dicam',
    priority: 75,
  },
  {
    keywords: ['distribuidora', '0775695846'],
    category: 'Proveedores',
    subcategory: 'Distribuidora',
    priority: 70,
  },
  {
    keywords: ['coml franca', '079806830k'],
    category: 'Proveedores',
    subcategory: 'Franca',
    priority: 75,
  },
  {
    keywords: ['coml santa ele', '0844724004'],
    category: 'Proveedores',
    subcategory: 'Santa Elena',
    priority: 75,
  },
  {
    keywords: ['importadora y', '0765416477'],
    category: 'Proveedores',
    subcategory: 'Importadora',
    priority: 75,
  },
  {
    keywords: ['trendy', '0781094706'],
    category: 'Proveedores',
    subcategory: 'Trendy',
    priority: 75,
  },
  {
    keywords: ['egg\'s group', '0778453614'],
    category: 'Proveedores',
    subcategory: 'Egg\'s Group',
    priority: 75,
  },
  {
    keywords: ['rubio andrade', '0201883989'],
    category: 'Proveedores',
    subcategory: 'Rubio Andrade',
    priority: 75,
  },

  // ── MOVILIZACIÓN / TRANSPORTE ─────────────────────────────────────────────
  {
    keywords: ['uber', 'payu *uber', 'uber *trip'],
    category: 'Movilización',
    subcategory: 'Rideshare',
    priority: 70,
  },
  {
    keywords: ['pasajebus', 'adm terminal buse', 'terminal bus'],
    category: 'Movilización',
    subcategory: 'Bus / Pasajes',
    priority: 70,
  },
  {
    keywords: ['copec', 'combustible', 'bencina'],
    category: 'Movilización',
    subcategory: 'Combustible',
    priority: 70,
  },
  {
    keywords: ['tuu*haulmer', 'haulmer'],
    category: 'Movilización',
    subcategory: 'Transporte carga',
    priority: 70,
  },

  // ── ENTRETENIMIENTO ───────────────────────────────────────────────────────
  {
    keywords: ['netflix', 'netflix.com'],
    category: 'Entretenimiento',
    subcategory: 'Streaming',
    priority: 70,
  },
  {
    keywords: ['paramount+', 'paramount'],
    category: 'Entretenimiento',
    subcategory: 'Streaming',
    priority: 70,
  },
  {
    keywords: ['zapping chile', 'zapping'],
    category: 'Entretenimiento',
    subcategory: 'Streaming',
    priority: 70,
  },
  {
    keywords: ['fantasilandia', 'mercadopago *fant'],
    category: 'Entretenimiento',
    subcategory: 'Parques / atracciones',
    priority: 70,
  },
  {
    keywords: ['space zone', 'botes chocadores', 'castillo encantad'],
    category: 'Entretenimiento',
    subcategory: 'Actividades recreativas',
    priority: 70,
  },
  {
    keywords: ['casino marina'],
    category: 'Entretenimiento',
    subcategory: 'Casino',
    priority: 70,
  },
  {
    keywords: ['derby'],
    category: 'Entretenimiento',
    subcategory: 'Bar / Pub',
    priority: 65,
  },

  // ── VIAJES / HOTEL ────────────────────────────────────────────────────────
  {
    keywords: ['hotel city expres', 'hotel'],
    category: 'Viajes',
    subcategory: 'Alojamiento',
    priority: 70,
  },
  {
    keywords: ['jetsmartairli', 'jetsmart', 'aerolinea', 'aerolínea'],
    category: 'Viajes',
    subcategory: 'Vuelos',
    priority: 70,
  },
  {
    keywords: ['rumbo espigon'],
    category: 'Viajes',
    subcategory: 'Actividades turísticas',
    priority: 65,
  },

  // ── VESTUARIO / ROPA ──────────────────────────────────────────────────────
  {
    keywords: ['h&m mall', 'h&m'],
    category: 'Gastos_Personales',
    subcategory: 'Vestuario',
    priority: 70,
  },
  {
    keywords: ['falabella', 'falabella arauco'],
    category: 'Gastos_Personales',
    subcategory: 'Vestuario',
    priority: 70,
  },
  {
    keywords: ['tommy hilfiger'],
    category: 'Gastos_Personales',
    subcategory: 'Vestuario',
    priority: 70,
  },
  {
    keywords: ['nvs concepcion', 'bold'],
    category: 'Gastos_Personales',
    subcategory: 'Vestuario',
    priority: 65,
  },
  {
    keywords: ['ferracini plaza'],
    category: 'Gastos_Personales',
    subcategory: 'Vestuario / Calzado',
    priority: 65,
  },
  {
    keywords: ['arauco maipu', 'mall arauco'],
    category: 'Gastos_Personales',
    subcategory: 'Shopping mall',
    priority: 60,
  },

  // ── SALUD / BELLEZA ───────────────────────────────────────────────────────
  {
    keywords: ['arcadia spa'],
    category: 'Gastos_Personales',
    subcategory: 'Belleza / Spa',
    priority: 65,
  },
  {
    keywords: ['yerty peluquer'],
    category: 'Gastos_Personales',
    subcategory: 'Peluquería',
    priority: 65,
  },

  // ── SERVICIOS PROFESIONALES ───────────────────────────────────────────────
  {
    keywords: ['contador carlo', '0187194199', '0783477998'],
    category: 'Servicios profesionales',
    subcategory: 'Contador',
    priority: 75,
  },
  {
    keywords: ['previred', 'pago en linea previred'],
    category: 'Laboral',
    subcategory: 'Previsión',
    priority: 75,
  },
  {
    keywords: ['s.i.i.', 'pago en linea s.i.i'],
    category: 'Impuestos',
    subcategory: 'SII',
    priority: 80,
  },
  {
    keywords: ['municipalidad vil'],
    category: 'Impuestos',
    subcategory: 'Municipalidad',
    priority: 75,
  },

  // ── FAMILIA ───────────────────────────────────────────────────────────────
  {
    keywords: ['transf a nicol', '0211964146'],
    category: 'Familia',
    subcategory: 'Transferencia familiar',
    priority: 70,
  },
  {
    keywords: ['transf a lorena', '0141965603 transf a lorena'],
    category: 'Familia',
    subcategory: 'Transferencia personal',
    priority: 70,
  },

  // ── DEPORTE ───────────────────────────────────────────────────────────────
  {
    keywords: ['soc com la casa l', 'la casa l'],
    category: 'Entretenimiento',
    subcategory: 'Deporte',
    priority: 65,
  },

  // ── MERCADO DIGITAL ───────────────────────────────────────────────────────
  {
    keywords: ['mercadopago', 'merpago'],
    category: 'Otros',
    subcategory: 'MercadoPago',
    priority: 50,
  },
  {
    keywords: ['chilexpress'],
    category: 'Otros',
    subcategory: 'Envíos / Courier',
    priority: 65,
  },

  // ── ABASTECIMIENTO AGUA / SERVICIOS ──────────────────────────────────────
  {
    keywords: ['nueva agua', 'mao nueva agua', '0779680010'],
    category: 'Hogar',
    subcategory: 'Agua',
    priority: 70,
  },
  {
    keywords: ['apr captacion', '0747909008'],
    category: 'Hogar',
    subcategory: 'Agua APR',
    priority: 70,
  },
  {
    keywords: ['soc de recauda', '0780537906'],
    category: 'Hogar',
    subcategory: 'Servicios básicos',
    priority: 70,
  },
  {
    keywords: ['marticorena cr', '0761481754'],
    category: 'Hogar',
    subcategory: 'Servicios',
    priority: 65,
  },

  // ── INVERSIONES ───────────────────────────────────────────────────────────
  {
    keywords: ['prex leo', '0137620162'],
    category: 'Inversiones',
    subcategory: 'Inversión / Ahorro',
    priority: 75,
  },

  // ── OTROS ─────────────────────────────────────────────────────────────────
  {
    keywords: ['pago en linea'],
    category: 'Otros',
    subcategory: 'Pago en línea',
    priority: 10,
  },
  {
    keywords: ['compra'],
    category: 'Otros',
    subcategory: 'Compra tarjeta',
    priority: 5,
  },
];

// ── Gasto hormiga: monto máximo según Excel de mentoría ─────────────────────
export const ANT_EXPENSE_MAX_AMOUNT = 16_000;

// ── Subcategorías excluidas del gasto hormiga ────────────────────────────────
export const ANT_EXPENSE_EXCLUDED_SUBCATEGORIES = [
  'Entre cuentas',
  'Crédito bancario',
  'Cooperativa',
  'PAC',
  'Previsión',
  'SII',
  'Municipalidad',
  'Ventas',
  'Depósito efectivo',
];
