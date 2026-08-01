import { db } from '../services/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import type { Addition, DashboardStats, Disbursement, Tool } from '../types';

const withdrawalsCollection = collection(db, 'withdrawals');
const additionsCollection = collection(db, 'additions');
const toolsCollection = collection(db, 'tools');

function toIdStr(id: string | number): string {
  return String(id);
}

// ---------- Helpers ----------
async function enrichDisbursements(list: any[]): Promise<Disbursement[]> {
  // Try to enrich tool_name client side
  try {
    const toolIds = Array.from(new Set(list.map(w => w.tool_id).filter(Boolean)));
    const toolMap = new Map<string, string>();
    // Firestore 'in' query max 10, so batch
    for (let i = 0; i < toolIds.length; i += 10) {
      const batch = toolIds.slice(i, i + 10);
      if (batch.length === 0) continue;
      const q = query(toolsCollection, where('__name__', 'in', batch as any));
      // __name__ doesn't work with string IDs in web? fallback to individual gets
      // We'll try individual gets for reliability
      const promises = batch.map(async (tid) => {
        try {
          const d = await getDoc(doc(db, 'tools', tid));
          if (d.exists()) toolMap.set(tid, (d.data() as any).name ?? '');
        } catch {}
      });
      await Promise.all(promises);
    }
    return list.map(w => ({
      ...w,
      tool_name: toolMap.get(w.tool_id) ?? w.tool_name ?? '',
    }));
  } catch {
    return list;
  }
}

// ---------- Subscriptions ----------
export function subscribeDisbursements(
  callback: (disbursements: Disbursement[]) => void
): Unsubscribe {
  const q = query(withdrawalsCollection, orderBy('withdrawn_at', 'desc'));
  return onSnapshot(q, async (snapshot) => {
    let data = snapshot.docs.map(d => {
      const raw = d.data() as any;
      return {
        id: d.id,
        tool_id: raw.tool_id,
        tool_name: raw.tool_name ?? '',
        quantity: raw.quantity,
        withdrawn_by: raw.withdrawn_by,
        recipient: raw.recipient,
        reason: raw.reason ?? null,
        status: raw.status ?? 'pending',
        withdrawn_at: raw.withdrawn_at?.toDate?.()?.toISOString?.() ?? raw.withdrawn_at ?? new Date().toISOString(),
        approved_by: raw.approved_by ?? null,
        notes: raw.notes ?? null,
      } as Disbursement;
    });
    // Enrich
    data = await enrichDisbursements(data);
    callback(data);
  }, (err) => {
    console.error('subscribeDisbursements error', err);
    callback([]);
  });
}

export function subscribeAdditions(
  callback: (additions: Addition[]) => void
): Unsubscribe {
  const q = query(additionsCollection, orderBy('added_at', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => {
      const raw = d.data() as any;
      return {
        id: d.id,
        tool_id: raw.tool_id,
        tool_name: raw.tool_name ?? '',
        quantity: raw.quantity,
        added_by: raw.added_by,
        source: raw.source ?? null,
        added_at: raw.added_at?.toDate?.()?.toISOString?.() ?? raw.added_at ?? new Date().toISOString(),
        notes: raw.notes ?? null,
      } as Addition;
    });
    callback(data);
  }, (err) => {
    console.error('subscribeAdditions error', err);
    callback([]);
  });
}

// ---------- Create Disbursement ----------
export interface DisburseInput {
  toolId: string | number;
  quantity: number;
  withdrawnBy: string;
  recipient: string;
  reason?: string | null;
  notes?: string | null;
  autoApprove: boolean;
}

export async function createDisbursement(
  input: DisburseInput
): Promise<{ id: string; status: 'pending' | 'approved' }> {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  if (!input.recipient?.trim()) throw new Error('اسم المستلم مطلوب');

  const toolIdStr = toIdStr(input.toolId);
  const status: 'pending' | 'approved' = input.autoApprove ? 'approved' : 'pending';

  const newDocRef = await runTransaction(db, async (transaction) => {
    const toolRef = doc(db, 'tools', toolIdStr);
    const toolDoc = await transaction.get(toolRef);
    if (!toolDoc.exists()) throw new Error('الأداة غير موجودة');
    const toolData = toolDoc.data() as any;
    if (toolData.is_deleted) throw new Error('الأداة محذوفة');

    if (status === 'approved' && (toolData.available_qty ?? 0) < qty) {
      throw new Error(`الكمية المتاحة غير كافية. المتاح حالياً: ${toolData.available_qty ?? 0}`);
    }

    const wdRef = doc(withdrawalsCollection);
    transaction.set(wdRef, {
      tool_id: toolIdStr,
      tool_name: toolData.name ?? '',
      quantity: qty,
      withdrawn_by: input.withdrawnBy,
      recipient: input.recipient.trim(),
      reason: input.reason || null,
      status,
      notes: input.notes || null,
      approved_by: status === 'approved' ? input.withdrawnBy : null,
      withdrawn_at: serverTimestamp(),
      expected_return: null,
      returned_qty: 0,
    });

    if (status === 'approved') {
      transaction.update(toolRef, {
        available_qty: (toolData.available_qty ?? 0) - qty,
        updated_at: serverTimestamp(),
      });
    }
    // Audit
    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: input.withdrawnBy,
      action: status === 'approved' ? 'withdraw' : 'withdraw_request',
      entity: 'withdrawal',
      entity_id: wdRef.id,
      details: `${toolData.name} x${qty} -> ${input.recipient}`,
      created_at: serverTimestamp(),
    });

    return wdRef;
  });

  return { id: newDocRef.id, status };
}

export async function approveDisbursement(id: string, approver: string): Promise<void> {
  const sid = toIdStr(id);
  await runTransaction(db, async (transaction) => {
    const wdRef = doc(db, 'withdrawals', sid);
    const wdDoc = await transaction.get(wdRef);
    if (!wdDoc.exists()) throw new Error('طلب الصرف غير موجود');
    const wdData = wdDoc.data() as any;
    if (wdData.status !== 'pending') throw new Error('الطلب ليس في حالة انتظار');

    const toolRef = doc(db, 'tools', wdData.tool_id);
    const toolDoc = await transaction.get(toolRef);
    if (!toolDoc.exists()) throw new Error('الأداة المرتبطة غير موجودة');
    const toolData = toolDoc.data() as any;

    if ((toolData.available_qty ?? 0) < wdData.quantity) {
      throw new Error(`الكمية المتاحة غير كافية. المتاح: ${toolData.available_qty ?? 0}`);
    }

    transaction.update(wdRef, { status: 'approved', approved_by: approver });
    transaction.update(toolRef, {
      available_qty: (toolData.available_qty ?? 0) - wdData.quantity,
      updated_at: serverTimestamp(),
    });

    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: approver,
      action: 'approve',
      entity: 'withdrawal',
      entity_id: sid,
      details: `approved ${wdData.tool_name ?? wdData.tool_id}`,
      created_at: serverTimestamp(),
    });
  });
}

export async function rejectDisbursement(id: string, approver: string): Promise<void> {
  const sid = toIdStr(id);
  const wdRef = doc(db, 'withdrawals', sid);
  await updateDoc(wdRef, { status: 'rejected', approved_by: approver });

  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor: approver,
      action: 'reject',
      entity: 'withdrawal',
      entity_id: sid,
      created_at: serverTimestamp(),
    });
  } catch {}
}

export async function listDisbursements(filter?: { toolId?: string | number }): Promise<Disbursement[]> {
  try {
    let snap;
    if (filter?.toolId) {
      // Avoid composite index requiring where+orderBy, fetch by where only then sort client side
      try {
        const q = query(withdrawalsCollection, where('tool_id', '==', toIdStr(filter.toolId)));
        snap = await getDocs(q);
      } catch {
        const q2 = query(withdrawalsCollection, orderBy('withdrawn_at', 'desc'));
        snap = await getDocs(q2);
        const toolStr = toIdStr(filter.toolId);
        snap = { docs: snap.docs.filter((d: any) => String(d.data().tool_id) === toolStr) } as any;
      }
    } else {
      const q = query(withdrawalsCollection, orderBy('withdrawn_at', 'desc'));
      snap = await getDocs(q);
    }
    let list = snap.docs.map((d: any) => {
      const raw = d.data() as any;
      return {
        id: d.id,
        tool_id: raw.tool_id,
        tool_name: raw.tool_name ?? '',
        quantity: raw.quantity,
        withdrawn_by: raw.withdrawn_by,
        recipient: raw.recipient,
        reason: raw.reason ?? null,
        status: raw.status ?? 'pending',
        withdrawn_at: raw.withdrawn_at?.toDate?.()?.toISOString?.() ?? raw.withdrawn_at ?? new Date().toISOString(),
        approved_by: raw.approved_by ?? null,
        notes: raw.notes ?? null,
      } as Disbursement;
    });
    // Sort client side desc
    list.sort((a: any, b: any) => new Date(b.withdrawn_at).getTime() - new Date(a.withdrawn_at).getTime());
    list = await enrichDisbursements(list);
    return list;
  } catch (e) {
    console.warn('listDisbursements failed', e);
    return [];
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [toolsSnap, wdSnap, addSnap] = await Promise.all([
      getDocs(query(toolsCollection, where('is_deleted', '==', false))),
      getDocs(withdrawalsCollection),
      getDocs(additionsCollection),
    ]);

    let totalTools = 0;
    let totalUnits = 0;
    let availableUnits = 0;
    let lowStockCount = 0;

    toolsSnap.docs.forEach(d => {
      const data = d.data() as any;
      totalTools += 1;
      const tot = Number(data.total_quantity ?? 0);
      const avail = Number(data.available_qty ?? 0);
      const min = Number(data.min_quantity ?? 0);
      totalUnits += tot;
      availableUnits += avail;
      if (min > 0 && avail <= min) lowStockCount += 1;
    });

    let activeDisbursements = 0;
    let pendingApprovals = 0;
    let overdueCount = 0;

    const now = new Date();
    wdSnap.docs.forEach(d => {
      const data = d.data() as any;
      const status = data.status;
      if (status === 'approved') activeDisbursements += 1;
      if (status === 'pending') pendingApprovals += 1;
      // Overdue check if expected_return exists
      if (data.expected_return && status === 'approved') {
        try {
          const exp = new Date(data.expected_return);
          if (exp < now) overdueCount += 1;
        } catch {}
      }
    });

    // Additions this month
    let additionsThisMonth = 0;
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0,0,0,0);
    addSnap.docs.forEach(d => {
      const data = d.data() as any;
      const at = data.added_at?.toDate?.() ?? (data.added_at ? new Date(data.added_at) : null);
      if (at && at >= firstOfMonth) additionsThisMonth += 1;
    });

    return {
      totalTools,
      totalUnits,
      availableUnits,
      activeDisbursements,
      pendingApprovals,
      overdueCount,
      lowStockCount,
      additionsThisMonth,
    };
  } catch (e) {
    console.error('getDashboardStats failed', e);
    return {
      totalTools: 0,
      totalUnits: 0,
      availableUnits: 0,
      activeDisbursements: 0,
      pendingApprovals: 0,
      overdueCount: 0,
      lowStockCount: 0,
      additionsThisMonth: 0,
    };
  }
}

export async function topWithdrawnTools(limit: number = 5): Promise<{ name: string; times: number; units: number }[]> {
  try {
    const snap = await getDocs(withdrawalsCollection);
    const map = new Map<string, { name: string; times: number; units: number }>();
    snap.docs.forEach(d => {
      const data = d.data() as any;
      const toolId = data.tool_id;
      const name = data.tool_name || `أداة ${toolId}`;
      const qty = Number(data.quantity ?? 0);
      if (!map.has(toolId)) map.set(toolId, { name, times: 0, units: 0 });
      const entry = map.get(toolId)!;
      entry.times += 1;
      entry.units += qty;
      if (name && name !== entry.name) entry.name = name;
    });
    return Array.from(map.values()).sort((a,b) => b.times - a.times).slice(0, limit);
  } catch {
    return [];
  }
}

// ---------- Additions ----------
export interface AdditionInput {
  toolId: string | number;
  quantity: number;
  addedBy: string;
  source?: string | null;
  notes?: string | null;
}

export async function createAddition(input: AdditionInput): Promise<string> {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  const toolIdStr = toIdStr(input.toolId);

  const newDocRef = await runTransaction(db, async (transaction) => {
    const toolRef = doc(db, 'tools', toolIdStr);
    const toolDoc = await transaction.get(toolRef);
    if (!toolDoc.exists()) throw new Error('الأداة غير موجودة');
    const toolData = toolDoc.data() as any;
    if (toolData.is_deleted) throw new Error('الأداة محذوفة');

    const addRef = doc(additionsCollection);
    transaction.set(addRef, {
      tool_id: toolIdStr,
      tool_name: toolData.name ?? '',
      quantity: qty,
      added_by: input.addedBy,
      source: input.source || null,
      notes: input.notes || null,
      added_at: serverTimestamp(),
    });

    transaction.update(toolRef, {
      total_quantity: (toolData.total_quantity ?? 0) + qty,
      available_qty: (toolData.available_qty ?? 0) + qty,
      updated_at: serverTimestamp(),
    });

    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: input.addedBy,
      action: 'addition',
      entity: 'addition',
      entity_id: addRef.id,
      details: `${toolData.name} +${qty}`,
      created_at: serverTimestamp(),
    });

    return addRef;
  });

  return newDocRef.id;
}

export async function listAdditions(filter?: { toolId?: string | number }): Promise<Addition[]> {
  try {
    let snap;
    if (filter?.toolId) {
      try {
        const q = query(additionsCollection, where('tool_id', '==', toIdStr(filter.toolId)));
        snap = await getDocs(q);
      } catch {
        const q2 = query(additionsCollection, orderBy('added_at', 'desc'));
        snap = await getDocs(q2);
        const toolStr = toIdStr(filter.toolId);
        snap = { docs: snap.docs.filter((d: any) => String(d.data().tool_id) === toolStr) } as any;
      }
    } else {
      const q = query(additionsCollection, orderBy('added_at', 'desc'));
      snap = await getDocs(q);
    }
    const list = snap.docs.map((d: any) => {
      const raw = d.data() as any;
      return {
        id: d.id,
        tool_id: raw.tool_id,
        tool_name: raw.tool_name ?? '',
        quantity: raw.quantity,
        added_by: raw.added_by,
        source: raw.source ?? null,
        added_at: raw.added_at?.toDate?.()?.toISOString?.() ?? raw.added_at ?? new Date().toISOString(),
        notes: raw.notes ?? null,
      } as Addition;
    });
    list.sort((a: any, b: any) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    return list;
  } catch (e) {
    console.warn('listAdditions failed', e);
    return [];
  }
}
