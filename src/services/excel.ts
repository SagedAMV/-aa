import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { createTool, listCategories, createCategory } from '../db/toolsRepo';
import { listDisbursements, listAdditions } from '../db/movementsRepo';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Tool } from '../types';

// إبقاء المرشّح محصوراً في الصيغ التي يستطيع التطبيق تحليلها. وجود `*/*`
// ضمن قائمة أنواع متعددة قد يسبب سلوكاً غير متسق في بعض تطبيقات الملفات على أندرويد.
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const EXCEL_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);


/**
 * تتم قراءة ومعاينة ملفات Excel على الجهاز باستخدام مكتبة xlsx.
 * لا يُرفع الملف نفسه إلى الإنترنت؛ وعند تأكيد المستخدم فقط تُحفظ البيانات
 * المستوردة عبر طبقة المستودعات الحالية (Firestore).
 */

export interface ImportRow {
  name: string;
  serial?: string;
  category?: string;
  location?: string;
  quantity: number;
  notes?: string;
  __row: number;
  __error?: string;
}

export interface ImportPreview {
  valid: ImportRow[];
  invalid: ImportRow[];
  fileName: string;
}

function normalizeHeader(h: string): string {
  const s = String(h || '').trim().toLowerCase();
  if (['الاسم', 'اسم', 'name', 'tool', 'الأداة'].includes(s)) return 'name';
  if (['الرقم التسلسلي', 'الرقم', 'serial', 'serial_number', 'باركود', 'barcode'].includes(s))
    return 'serial';
  if (['التصنيف', 'الفئة', 'category', 'cat'].includes(s)) return 'category';
  if (['الموقع', 'المكان', 'location', 'loc'].includes(s)) return 'location';
  if (['الكمية', 'العدد', 'quantity', 'qty', 'الكميه'].includes(s)) return 'quantity';
  if (['ملاحظات', 'ملاحظة', 'notes', 'note', 'ملاحظه'].includes(s)) return 'notes';
  return s;
}

export async function pickAndParseExcel(): Promise<ImportPreview | null> {
  let result: Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>;

  try {
    result = await DocumentPicker.getDocumentAsync({
      type: EXCEL_MIME_TYPES,
      // يجعل URI قابلاً للقراءة من expo-file-system بدلاً من content:// المؤقت.
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error(
      `تعذر فتح منتقي الملفات${message ? `: ${message}` : ''}. أعد تشغيل التطبيق ثم حاول مرة أخرى.`
    );
  }

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (!asset?.uri || !asset.name) {
    throw new Error('لم يُرجع منتقي الملفات ملفاً صالحاً. حاول اختيار الملف مرة أخرى.');
  }

  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (!extension || !EXCEL_EXTENSIONS.has(extension)) {
    throw new Error('اختر ملف Excel بصيغة .xlsx أو .xls أو ملف CSV فقط.');
  }

  const file = new File(asset.uri);
  let b64: string;
  try {
    b64 = await file.base64();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error(
      `تعذر قراءة الملف «${asset.name}»${message ? `: ${message}` : ''}. تأكد من أن الملف متاح على الجهاز.`
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(b64, { type: 'base64' });
  } catch {
    throw new Error('تعذر تحليل الملف. تأكد من أنه ملف Excel أو CSV صالح وغير تالف.');
  }

  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    throw new Error('الملف لا يحتوي على أي ورقة بيانات قابلة للاستيراد.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error('تعذر فتح أول ورقة بيانات في الملف.');
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];

  raw.forEach((r, idx) => {
    const mapped: Record<string, string> = {};
    Object.keys(r).forEach((k) => {
      mapped[normalizeHeader(k)] = String(r[k] ?? '').trim();
    });

    const name = mapped.name || '';
    const qtyRaw = mapped.quantity || '1';
    const qty = parseInt(qtyRaw, 10);

    const row: ImportRow = {
      name,
      serial: mapped.serial || undefined,
      category: mapped.category || undefined,
      location: mapped.location || undefined,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      notes: mapped.notes || undefined,
      __row: idx + 2,
    };

    if (!name) {
      row.__error = 'الاسم مفقود (عمود مطلوب)';
      invalid.push(row);
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid, fileName: asset.name };
}

export async function commitImport(
  rows: ImportRow[],
  actor: string
): Promise<{ inserted: number; failed: number }> {
  // Prepare categories cache
  const existingCats = await listCategories();
  const catMap = new Map<string, string>(); // name -> id
  existingCats.forEach(c => catMap.set(c.name.trim().toLowerCase(), String(c.id)));

  let inserted = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      let categoryId: string | null = null;
      if (r.category) {
        const key = r.category.trim().toLowerCase();
        if (catMap.has(key)) {
          categoryId = catMap.get(key)!;
        } else {
          // Create new category
          try {
            const newId = await createCategory(r.category.trim());
            catMap.set(key, newId);
            categoryId = newId;
          } catch {}
        }
      }

      await createTool(
        {
          name: r.name,
          serial_number: r.serial ?? null,
          barcode: null,
          category_id: categoryId as any,
          location: r.location ?? null,
          total_quantity: r.quantity,
          min_quantity: 0,
          notes: r.notes ?? null,
        },
        actor
      );
      inserted++;
    } catch (e) {
      console.error('commitImport row failed', e);
      failed++;
    }
  }
  return { inserted, failed };
}

export async function exportTemplate(): Promise<string> {
  const data = [
    ['الاسم', 'الرقم التسلسلي', 'التصنيف', 'الموقع', 'الكمية', 'ملاحظات'],
    ['مفك براغي', 'SN-001', 'يدوية', 'رف A1', '10', 'مثال'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قالب');
  return writeWorkbook(wb, 'قالب_استيراد_الأدوات.xlsx');
}

export async function exportInventory(): Promise<string> {
  const querySnapshot = await getDocs(collection(db, 'tools'));
  const tools = querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any as Tool))
    .filter(t => !t.is_deleted);

  const rows = tools.map((t) => ({
    'الاسم': t.name,
    'الرقم التسلسلي': t.serial_number ?? '',
    'الباركود': t.barcode ?? '',
    'التصنيف': (t as any).category_name ?? '',
    'الموقع': t.location ?? '',
    'الكمية الإجمالية': t.total_quantity,
    'المتاح': t.available_qty,
    'مسحوب': t.total_quantity - t.available_qty,
    'حد التنبيه': t.min_quantity,
    'ملاحظات': t.notes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'الاسم': '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الجرد');
  return writeWorkbook(wb, `جرد_المخزن_${stamp()}.xlsx`);
}

export async function exportMovements(
  from?: string,
  to?: string
): Promise<string> {
  let wds = await listDisbursements();
  let adds = await listAdditions();

  // Date filtering if provided
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate || toDate) {
    wds = wds.filter(w => {
      const d = new Date(w.withdrawn_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
    adds = adds.filter(a => {
      const d = new Date(a.added_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }

  const wdRows = wds.map((w) => ({
    'الأداة': (w as any).tool_name ?? w.tool_id ?? '',
    'الكمية': w.quantity,
    'المستلم': w.recipient,
    'المُنفِّذ': w.withdrawn_by,
    'السبب': w.reason ?? '',
    'الحالة': statusAr(w.status),
    'تاريخ الصرف': w.withdrawn_at?.slice(0, 16) ?? '',
    'ملاحظات': w.notes ?? '',
  }));

  const addRows = adds.map((a) => ({
    'الأداة': (a as any).tool_name ?? a.tool_id ?? '',
    'الكمية': a.quantity,
    'المُضيف': a.added_by,
    'المصدر': a.source ?? '',
    'التاريخ': a.added_at?.slice(0, 16) ?? '',
    'ملاحظات': a.notes ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(wdRows.length ? wdRows : [{ 'الأداة': '' }]),
    'الصرف'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(addRows.length ? addRows : [{ 'الأداة': '' }]),
    'الإضافات'
  );
  return writeWorkbook(wb, `الحركات_${stamp()}.xlsx`);
}

async function writeWorkbook(
  wb: XLSX.WorkBook,
  fileName: string
): Promise<string> {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const file = new File(Paths.document, fileName);
  if (file.exists) file.delete();
  file.create();
  try {
    // @ts-ignore - new API
    file.write(b64, { encoding: 'base64' } as any);
  } catch {
    // fallback
    try {
      // @ts-ignore
      file.write(b64);
    } catch (e) {
      throw new Error('فشل كتابة ملف Excel');
    }
  }

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'حفظ / مشاركة الملف',
      });
    } catch {}
  }
  return file.uri;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(
    d.getHours()
  )}${p(d.getMinutes())}`;
}

export function statusAr(s: string): string {
  switch (s) {
    case 'pending':
      return 'بانتظار الموافقة';
    case 'approved':
      return 'مصروفة';
    case 'rejected':
      return 'مرفوضة';
    case 'returned':
      return 'أُرجعت';
    case 'partial':
      return 'إرجاع جزئي';
    default:
      return s;
  }
}
