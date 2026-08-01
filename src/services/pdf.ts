import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { listDisbursements, topWithdrawnTools } from '../db/movementsRepo';
import { statusAr } from './excel';
import type { Tool } from '../types';

/**
 * توليد تقارير PDF محلياً عبر expo-print (محرك WebView داخلي).
 * لا يعتمد على أي خدمة تحويل سحابية.
 */

const BASE_CSS = `
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, Roboto, "Noto Naskh Arabic", sans-serif;
      direction: rtl; padding: 24px; color: #111827;
    }
    h1 { color: #0F766E; font-size: 22px; margin: 0 0 4px; }
    .sub { color: #6B7280; font-size: 12px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0F766E; color: #fff; padding: 8px; text-align: right; }
    td { padding: 7px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .cards { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
    .card {
      border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 10px 14px; min-width: 110px;
    }
    .card .n { font-size: 20px; font-weight: 700; color: #0F766E; }
    .card .l { font-size: 11px; color: #6B7280; }
    .danger { color: #DC2626; font-weight: 700; }
    footer { margin-top: 24px; font-size: 10px; color: #9CA3AF; text-align: center; }
  </style>
`;

function shell(title: string, body: string): string {
  const now = new Date().toLocaleString('ar-EG');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
    <title>${esc(title)}</title>${BASE_CSS}</head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">نظام إدارة مخزن الأدوات — تم الإنشاء: ${esc(now)}</div>
    ${body}
    <footer>تقرير مُولَّد محلياً على الجهاز — قسم الاتصالات / إدارة المخازن</footer>
  </body></html>`;
}

async function printAndShare(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'حفظ / مشاركة التقرير',
        UTI: 'com.adobe.pdf',
      });
    } catch {}
  }
  return uri;
}

export async function reportInventoryPdf(): Promise<string> {
  const querySnapshot = await getDocs(collection(db, 'tools'));
  const tools = querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter((t: any) => !t.is_deleted) as Tool[];

  const totalUnits = tools.reduce((s, t) => s + (t.total_quantity ?? 0), 0);
  const availUnits = tools.reduce((s, t) => s + (t.available_qty ?? 0), 0);

  const rows = tools
    .map(
      (t, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(t.name)}</td>
        <td>${esc(t.serial_number ?? '-')}</td>
        <td>${esc((t as any).category_name ?? '-')}</td>
        <td>${esc(t.location ?? '-')}</td>
        <td>${t.total_quantity}</td>
        <td>${t.available_qty}</td>
        <td>${t.total_quantity - t.available_qty}</td>
      </tr>`
    )
    .join('');

  const body = `
    <div class="cards">
      <div class="card"><div class="n">${tools.length}</div><div class="l">عدد الأصناف</div></div>
      <div class="card"><div class="n">${totalUnits}</div><div class="l">إجمالي الوحدات</div></div>
      <div class="card"><div class="n">${availUnits}</div><div class="l">المتاح</div></div>
      <div class="card"><div class="n">${totalUnits - availUnits}</div><div class="l">مسحوب</div></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>الاسم</th><th>الرقم التسلسلي</th><th>التصنيف</th>
        <th>الموقع</th><th>الإجمالي</th><th>المتاح</th><th>مسحوب</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="8">لا توجد بيانات</td></tr>'}</tbody>
    </table>`;

  return printAndShare(shell('تقرير جرد المخزن', body));
}

export async function reportDisbursementsPdf(
  from?: string,
  to?: string
): Promise<string> {
  let list = await listDisbursements();
  
  if (from || to) {
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    list = list.filter(w => {
      const d = new Date(w.withdrawn_at);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
      return true;
    });
  }

  const rows = list
    .map(
      (w, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc((w as any).tool_name ?? '')}</td>
        <td>${w.quantity}</td>
        <td>${esc(w.recipient)}</td>
        <td>${esc(w.withdrawn_by)}</td>
        <td>${esc(statusAr(w.status))}</td>
        <td>${esc(w.withdrawn_at?.slice(0,16) ?? '')}</td>
        <td>${esc((w as any).expected_return ?? '-')}</td>
      </tr>`
    )
    .join('');

  const body = `
    <div class="cards">
      <div class="card"><div class="n">${list.length}</div><div class="l">عدد عمليات الصرف</div></div>
      <div class="card"><div class="n">${list.reduce((s, w) => s + w.quantity, 0)}</div><div class="l">إجمالي الوحدات</div></div>
      <div class="card"><div class="n">${from ?? 'البداية'} - ${to ?? 'اليوم'}</div><div class="l">الفترة</div></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>الأداة</th><th>الكمية</th><th>المستلم</th>
        <th>المُنفِّذ</th><th>الحالة</th><th>تاريخ الصرف</th><th>الإرجاع المتوقع</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="8">لا توجد بيانات</td></tr>'}</tbody>
    </table>`;

  return printAndShare(shell('تقرير الصرف', body));
}

export async function reportOverduePdf(): Promise<string> {
  const snap = await getDocs(collection(db, 'withdrawals'));
  const now = new Date();
  const overdue: any[] = [];
  snap.docs.forEach(d => {
    const data = d.data() as any;
    if (data.status !== 'approved') return;
    if (!data.expected_return) return;
    const exp = new Date(data.expected_return);
    if (exp < now) overdue.push({ id: d.id, ...data });
  });

  const rows = overdue.map((w, i) => `<tr>
    <td>${i+1}</td>
    <td>${esc(w.tool_name ?? w.tool_id)}</td>
    <td>${w.quantity}</td>
    <td>${esc(w.recipient)}</td>
    <td>${esc(w.expected_return ?? '')}</td>
    <td class="danger">${Math.ceil((now.getTime() - new Date(w.expected_return).getTime()) / (1000*60*60*24))} يوم</td>
  </tr>`).join('');

  const body = `
    <div class="cards">
      <div class="card"><div class="n">${overdue.length}</div><div class="l">أدوات متأخرة</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>الأداة</th><th>الكمية</th><th>المستلم</th><th>موعد الإرجاع</th><th>التأخير</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">لا توجد أدوات متأخرة ✅</td></tr>'}</tbody>
    </table>
  `;

  return printAndShare(shell('تقرير الأدوات المتأخرة', body));
}

export async function reportTopToolsPdf(): Promise<string> {
  const top = await topWithdrawnTools(15);
  const rows = top.map((t, i) => `<tr>
    <td>${i+1}</td>
    <td>${esc(t.name)}</td>
    <td>${t.times}</td>
    <td>${t.units}</td>
  </tr>`).join('');

  const body = `
    <table>
      <thead><tr><th>#</th><th>الأداة</th><th>عدد مرات الصرف</th><th>إجمالي الوحدات المصروفة</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">لا توجد بيانات</td></tr>'}</tbody>
    </table>
  `;

  return printAndShare(shell('تقرير أكثر الأدوات صرفاً', body));
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
