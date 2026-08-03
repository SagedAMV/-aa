import { db } from '../services/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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
import type { Addition, DashboardStats, Disbursement, Tool, WithdrawType, ReturnedCondition } from '../types';

const withdrawalsCollection = collection(db, 'withdrawals');
const additionsCollection = collection(db, 'additions');
const toolsCollection = collection(db, 'tools');

function toIdStr(id: string | number): string {
  return String(id);
}

// ---------- Helpers ----------
async function enrichDisbursements(list: any[]): Promise<Disbursement[]> {
  try {
    const toolIds = Array.from(new Set(list.map(w => w.tool_id).filter(Boolean)));
    const toolMap = new Map<string, string>();
    for (let i = 0; i < toolIds.length; i += 10) {
      const batch = toolIds.slice(i, i + 10);
      if (batch.length === 0) continue;
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
        returned_qty: raw.returned_qty ?? 0,
        expected_return: raw.expected_return ?? null,
        returned_at: raw.returned_at ?? null,
        withdraw_type: raw.withdraw_type ?? 'permanent',
        return_condition: raw.return_condition ?? null,
      } as Disbursement;
    });
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
        status: raw.status ?? 'approved',
        approved_by: raw.approved_by ?? null,
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
  withdrawType?: WithdrawType;
  expectedReturn?: string | null;
}

export async function createDisbursement(
  input: DisburseInput
): Promise<{ id: string; status: 'pending' | 'approved' }> {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  if (!input.recipient?.trim()) throw new Error('اسم المستلم مطلوب');

  const toolIdStr = toIdStr(input.toolId);
  const status: 'pending' | 'approved' = input.autoApprove ? 'approved' : 'pending';
  const withdrawType = input.withdrawType ?? 'permanent';

  // إذا كان صرف مؤقت، يجب تحديد موعد الإرجاع
  if (withdrawType === 'temporary' && !input.expectedReturn) {
    throw new Error('يجب تحديد موعد الإرجاع للصرف المؤقت');
  }

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
      expected_return: withdrawType === 'temporary' ? input.expectedReturn : null,
      returned_qty: 0,
      withdraw_type: withdrawType,
      return_condition: null,
      returned_at: null,
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
      action: status === 'approved' ? 'withdraw_direct' : 'withdraw_request',
      entity: 'withdrawal',
      entity_id: wdRef.id,
      details: JSON.stringify({
        tool_name: toolData.name,
        quantity: qty,
        recipient: input.recipient,
        withdraw_type: withdrawType,
        expected_return: input.expectedReturn,
      }),
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
      details: JSON.stringify({
        tool_name: wdData.tool_name,
        quantity: wdData.quantity,
        original_request_by: wdData.withdrawn_by,
      }),
      created_at: serverTimestamp(),
    });
  });
}

export async function rejectDisbursement(id: string, approver: string): Promise<void> {
  const sid = toIdStr(id);
  const wdRef = doc(db, 'withdrawals', sid);
  const wdDoc = await getDoc(wdRef);
  if (!wdDoc.exists()) throw new Error('طلب الصرف غير موجود');
  const wdData = wdDoc.data() as any;
  
  await updateDoc(wdRef, { status: 'rejected', approved_by: approver });

  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor: approver,
      action: 'reject',
      entity: 'withdrawal',
      entity_id: sid,
      details: JSON.stringify({
        tool_name: wdData.tool_name,
        quantity: wdData.quantity,
        original_request_by: wdData.withdrawn_by,
      }),
      created_at: serverTimestamp(),
    });
  } catch {}
}

// ---------- إرجاع أداة ----------
export interface ReturnInput {
  disbursementId: string;
  returnedQty: number;
  returnedBy: string;
  condition?: ReturnedCondition;
  notes?: string;
}

export async function returnDisbursement(input: ReturnInput): Promise<void> {
  const sid = toIdStr(input.disbursementId);
  const returnQty = Math.floor(Number(input.returnedQty));
  
  if (!Number.isFinite(returnQty) || returnQty <= 0) {
    throw new Error('الكمية المُرجعة يجب أن تكون أكبر من صفر');
  }

  await runTransaction(db, async (transaction) => {
    const wdRef = doc(db, 'withdrawals', sid);
    const wdDoc = await transaction.get(wdRef);
    if (!wdDoc.exists()) throw new Error('عملية الصرف غير موجودة');
    const wdData = wdDoc.data() as any;
    
    if (wdData.status !== 'approved') {
      throw new Error('يمكن إرجاع عملية مصروفة فقط');
    }

    const originalQty = wdData.quantity;
    const alreadyReturned = wdData.returned_qty ?? 0;
    
    if (alreadyReturned + returnQty > originalQty) {
      throw new Error(`الكمية المُرجعة تتجاوز المسموح. المتبقي للإرجاع: ${originalQty - alreadyReturned}`);
    }

    const newReturnedQty = alreadyReturned + returnQty;
    const isFullyReturned = newReturnedQty >= originalQty;
    
    const toolRef = doc(db, 'tools', wdData.tool_id);
    const toolDoc = await transaction.get(toolRef);
    if (!toolDoc.exists()) throw new Error('الأداة غير موجودة');
    const toolData = toolDoc.data() as any;

    // تحديث عملية الصرف
    transaction.update(wdRef, {
      returned_qty: newReturnedQty,
      return_condition: input.condition ?? wdData.return_condition ?? null,
      returned_at: isFullyReturned ? serverTimestamp() : wdData.returned_at,
      status: isFullyReturned ? 'returned' : 'partial',
    });

    // إعادة الكمية للمخزن
    transaction.update(toolRef, {
      available_qty: (toolData.available_qty ?? 0) + returnQty,
      updated_at: serverTimestamp(),
    });

    // Audit
    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: input.returnedBy,
      action: 'return',
      entity: 'withdrawal',
      entity_id: sid,
      details: JSON.stringify({
        tool_name: wdData.tool_name,
        returned_qty: returnQty,
        total_returned: newReturnedQty,
        original_qty: originalQty,
        is_fully_returned: isFullyReturned,
        condition: input.condition,
      }),
      created_at: serverTimestamp(),
    });
  });
}

// ---------- حذف عملية صرف ----------
export async function deleteDisbursement(id: string, deletedBy: string): Promise<void> {
  const sid = toIdStr(id);
  
  await runTransaction(db, async (transaction) => {
    const wdRef = doc(db, 'withdrawals', sid);
    const wdDoc = await transaction.get(wdRef);
    if (!wdDoc.exists()) throw new Error('عملية الصرف غير موجودة');
    const wdData = wdDoc.data() as any;

    // حساب الكمية المتبقية التي لم تُرجع
    const remainingQty = wdData.quantity - (wdData.returned_qty ?? 0);
    
    // إعادة الكمية للمخزن فقط إذا كانت العملية مصروفة (approved أو partial)
    // العمليات المعلقة (pending) أو المرفوضة (rejected) لم تُخصم من المخزن أساساً
    // العمليات المرتجعة (returned) أُرِجعت بالكامل
    if ((wdData.status === 'approved' || wdData.status === 'partial') && remainingQty > 0) {
      const toolRef = doc(db, 'tools', wdData.tool_id);
      const toolDoc = await transaction.get(toolRef);
      if (toolDoc.exists()) {
        const toolData = toolDoc.data() as any;
        transaction.update(toolRef, {
          available_qty: (toolData.available_qty ?? 0) + remainingQty,
          updated_at: serverTimestamp(),
        });
      }
    }

    // حذف عملية الصرف
    transaction.delete(wdRef);

    // Audit
    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: deletedBy,
      action: 'delete',
      entity: 'withdrawal',
      entity_id: sid,
      details: JSON.stringify({
        tool_name: wdData.tool_name,
        quantity: wdData.quantity,
        status: wdData.status,
        returned_qty: wdData.returned_qty ?? 0,
        qty_restored: (wdData.status === 'approved' || wdData.status === 'partial') ? remainingQty : 0,
      }),
      created_at: serverTimestamp(),
    });
  });
}

// ---------- حذف عمليات صرف متعددة ----------
export async function deleteMultipleDisbursements(
  ids: string[],
  deletedBy: string
): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      await deleteDisbursement(id, deletedBy);
      deleted++;
    } catch (e: any) {
      errors.push(`عملية ${id}: ${e.message}`);
    }
  }

  return { deleted, errors };
}

export async function listDisbursements(filter?: { toolId?: string | number }): Promise<Disbursement[]> {
  try {
    let snap;
    if (filter?.toolId) {
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
        returned_qty: raw.returned_qty ?? 0,
        expected_return: raw.expected_return ?? null,
        returned_at: raw.returned_at ?? null,
        withdraw_type: raw.withdraw_type ?? 'permanent',
        return_condition: raw.return_condition ?? null,
      } as Disbursement;
    });
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
      // Overdue check for temporary disbursements
      if (data.withdraw_type === 'temporary' && data.expected_return && status === 'approved') {
        try {
          const exp = new Date(data.expected_return);
          if (exp < now) overdueCount += 1;
        } catch {}
      }
    });

    let additionsThisMonth = 0;
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
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
      totalTools: 0, totalUnits: 0, availableUnits: 0,
      activeDisbursements: 0, pendingApprovals: 0,
      overdueCount: 0, lowStockCount: 0, additionsThisMonth: 0,
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
    return Array.from(map.values()).sort((a, b) => b.times - a.times).slice(0, limit);
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
  autoApprove?: boolean;
}

export async function createAddition(input: AdditionInput): Promise<string> {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  const toolIdStr = toIdStr(input.toolId);
  const autoApprove = input.autoApprove !== false; // default true
  const status = autoApprove ? 'approved' : 'pending';

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
      status,
      approved_by: autoApprove ? input.addedBy : null,
    });

    // إذا تمت الموافقة مباشرة، أضف الكمية فوراً
    if (autoApprove) {
      transaction.update(toolRef, {
        total_quantity: (toolData.total_quantity ?? 0) + qty,
        available_qty: (toolData.available_qty ?? 0) + qty,
        updated_at: serverTimestamp(),
      });
    }

    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: input.addedBy,
      action: autoApprove ? 'addition' : 'addition_request',
      entity: 'addition',
      entity_id: addRef.id,
      details: JSON.stringify({
        tool_name: toolData.name,
        quantity: qty,
        source: input.source,
      }),
      created_at: serverTimestamp(),
    });

    return addRef;
  });

  return newDocRef.id;
}

// الموافقة على إضافة كمية
export async function approveAddition(id: string, approver: string): Promise<void> {
  const sid = toIdStr(id);
  await runTransaction(db, async (transaction) => {
    const addRef = doc(db, 'additions', sid);
    const addDoc = await transaction.get(addRef);
    if (!addDoc.exists()) throw new Error('طلب الإضافة غير موجود');
    const addData = addDoc.data() as any;
    if (addData.status !== 'pending') throw new Error('الطلب ليس في حالة انتظار');

    const toolRef = doc(db, 'tools', addData.tool_id);
    const toolDoc = await transaction.get(toolRef);
    if (!toolDoc.exists()) throw new Error('الأداة غير موجودة');
    const toolData = toolDoc.data() as any;

    transaction.update(addRef, { status: 'approved', approved_by: approver });
    transaction.update(toolRef, {
      total_quantity: (toolData.total_quantity ?? 0) + addData.quantity,
      available_qty: (toolData.available_qty ?? 0) + addData.quantity,
      updated_at: serverTimestamp(),
    });

    const auditRef = doc(collection(db, 'audit_logs'));
    transaction.set(auditRef, {
      actor: approver,
      action: 'approve',
      entity: 'addition',
      entity_id: sid,
      details: JSON.stringify({
        tool_name: addData.tool_name,
        quantity: addData.quantity,
        original_request_by: addData.added_by,
      }),
      created_at: serverTimestamp(),
    });
  });
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
        status: raw.status ?? 'approved',
        approved_by: raw.approved_by ?? null,
      } as Addition;
    });
    list.sort((a: any, b: any) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    return list;
  } catch (e) {
    console.warn('listAdditions failed', e);
    return [];
  }
}
