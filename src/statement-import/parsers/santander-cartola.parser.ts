import * as fs from 'fs';

// pdfjs-dist legacy build — funciona en Node.js sin Python
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface CartolaSantanderHeader {
  accountNumber: string | null;
  accountHolder: string | null;
  rut: string | null;
  currency: string;
  branch: string | null;
  statementNumber: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  openingBalance: number | null;
  deposits: number | null;
  otherCredits: number | null;
  otherDebits: number | null;
  closingBalance: number | null;
}

export interface CartolaSantanderRow {
  date: string;            // YYYY-MM-DD
  debit: number | null;    // cargo (egreso)
  credit: number | null;   // abono (ingreso)
  description: string;
  balance: number | null;
  docNumber: string;
  branch: string;
  movementType: 'income' | 'expense';
}

export interface CartolaSantanderResult {
  header: CartolaSantanderHeader;
  rows: CartolaSantanderRow[];
  totalRows: number;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function parseChileanAmount(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const AMOUNT_RE = /^\$?\s*[\d.]+$/;
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}

function classifyMovement(
  credit: number | null,
  debit: number | null,
  description: string,
): 'income' | 'expense' {
  if (credit !== null && debit === null) return 'income';
  if (debit !== null && credit === null) return 'expense';
  const d = description.toLowerCase();
  return d.includes('abono') || d.includes('depósito') || d.includes('reverso')
    ? 'income'
    : 'expense';
}

// ─── Extracción de líneas del PDF ─────────────────────────────────────────────

interface PdfItem { str: string; x: number; y: number }
interface PdfLine { y: number; items: PdfItem[] }

async function extractLines(pdfBuffer: Buffer): Promise<PdfLine[]> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  const allLines: PdfLine[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const byY = new Map<number, PdfItem[]>();
    for (const item of (content.items as any[])) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ str: item.str.trim(), x, y });
    }

    const sorted = [...byY.entries()]
      .sort(([a], [b]) => b - a)
      .map(([y, items]) => ({ y, items: items.sort((a, b) => a.x - b.x) }));

    allLines.push(...sorted);
  }

  return allLines;
}

// ─── Parser de encabezado ─────────────────────────────────────────────────────

function parseHeader(lines: PdfLine[]): CartolaSantanderHeader {
  const header: CartolaSantanderHeader = {
    accountNumber: null, accountHolder: null, rut: null,
    currency: 'CLP', branch: null, statementNumber: null,
    dateFrom: null, dateTo: null,
    openingBalance: null, deposits: null, otherCredits: null,
    otherDebits: null, closingBalance: null,
  };

  const text = lines.slice(0, 40).map((l) => l.items.map((i) => i.str).join(' ')).join('\n');

  const matchers: [RegExp, (m: RegExpMatchArray) => void][] = [
    [/Cuenta:\s*([\d\-]+)/, (m) => { header.accountNumber = m[1]; }],
    [/RUT empresa:\s*([\d.\-]+)/, (m) => { header.rut = m[1]; }],
    [/Fecha desde:\s*([\d/]+)/, (m) => { header.dateFrom = m[1]; }],
    [/Fecha hasta:\s*([\d/]+)/, (m) => { header.dateTo = m[1]; }],
    [/Número cartola:\s*(\d+)/, (m) => { header.statementNumber = m[1]; }],
    [/Saldo inicial:\s*\$\s*([\d.]+)/, (m) => { header.openingBalance = parseChileanAmount(m[1]); }],
    [/Depósitos:\s*\$\s*([\d.]+)/, (m) => { header.deposits = parseChileanAmount(m[1]); }],
    [/Otros abonos:\s*\$\s*([\d.]+)/, (m) => { header.otherCredits = parseChileanAmount(m[1]); }],
    [/Otros cargos:\s*\$\s*([\d.]+)/, (m) => { header.otherDebits = parseChileanAmount(m[1]); }],
    [/Saldo final:\s*\$\s*([\d.]+)/, (m) => { header.closingBalance = parseChileanAmount(m[1]); }],
    [/Sr\.\s*\(a\):\s*(.+?)\s{2,}/, (m) => { header.accountHolder = m[1].trim(); }],
  ];

  for (const [re, setter] of matchers) {
    const m = text.match(re);
    if (m) setter(m);
  }

  return header;
}

// ─── Parser de movimientos ────────────────────────────────────────────────────

function parseRows(lines: PdfLine[]): CartolaSantanderRow[] {
  // Detectar posiciones X de columnas desde el header de la tabla
  let colX: Record<string, number> | null = null;

  for (const line of lines) {
    const strs = line.items.map((i) => i.str);
    if (strs.includes('FECHA') && strs.includes('CARGO') && strs.includes('ABONO')) {
      colX = {};
      for (const item of line.items) {
        colX[item.str] = item.x;
      }
      break;
    }
  }

  if (!colX) return [];

  const cargoX  = colX['CARGO']     ?? 150;
  const abonoX  = colX['ABONO']     ?? 230;
  const descX   = colX['DESCRIPCIÓN'] ?? 310;
  const saldoX  = colX['SALDO']     ?? 450;
  const docX    = colX['N° DOC']    ?? 530;
  const sucX    = colX['SUCURSAL']  ?? 600;
  const TOL = 45;

  const SKIP = ['Nota:', 'Infórmese', 'de 14', 'FECHA', 'Resumen', 'Saldos diarios'];
  const rows: CartolaSantanderRow[] = [];

  type Draft = { date: string; debit: number | null; credit: number | null; balance: number | null; docNumber: string; branch: string; descParts: string[] };
  let cur: Draft | null = null;

  const flush = () => {
    if (!cur) return;
    const desc = cur.descParts.join(' ').trim();
    rows.push({
      date: cur.date,
      debit: cur.debit,
      credit: cur.credit,
      description: desc,
      balance: cur.balance,
      docNumber: cur.docNumber,
      branch: cur.branch,
      movementType: classifyMovement(cur.credit, cur.debit, desc),
    });
    cur = null;
  };

  for (const line of lines) {
    const joined = line.items.map((i) => i.str).join(' ');
    if (SKIP.some((s) => joined.includes(s))) continue;

    const first = line.items[0];
    if (!first) continue;

    if (DATE_RE.test(first.str)) {
      flush();
      cur = { date: toIsoDate(first.str), debit: null, credit: null, balance: null, docNumber: '', branch: '', descParts: [] };

      for (const item of line.items.slice(1)) {
        const { x, str } = item;
        if (Math.abs(x - cargoX) <= TOL && AMOUNT_RE.test(str)) {
          cur.debit = parseChileanAmount(str);
        } else if (Math.abs(x - abonoX) <= TOL && AMOUNT_RE.test(str)) {
          cur.credit = parseChileanAmount(str);
        } else if (Math.abs(x - saldoX) <= TOL && AMOUNT_RE.test(str)) {
          cur.balance = parseChileanAmount(str);
        } else if (x >= sucX - TOL) {
          cur.branch = str;
        } else if (x >= docX - TOL) {
          cur.docNumber = str;
        } else if (x >= descX - TOL) {
          cur.descParts.push(str);
        }
      }
    } else if (cur) {
      // Continuación de descripción multilínea
      for (const item of line.items) {
        if (item.x >= descX - TOL && item.x < saldoX) {
          cur.descParts.push(item.str);
        }
      }
    }
  }
  flush();

  return rows;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Parsea una cartola Santander (formato Office Banking) desde un Buffer PDF.
 * No requiere Python — usa pdfjs-dist que ya es dependencia de NestJS.
 *
 * @param pdfBuffer  Buffer del archivo PDF
 */
export async function parseSantanderCartola(
  pdfBuffer: Buffer,
): Promise<CartolaSantanderResult> {
  const lines = await extractLines(pdfBuffer);
  const header = parseHeader(lines);
  const rows = parseRows(lines);
  return { header, rows, totalRows: rows.length };
}
