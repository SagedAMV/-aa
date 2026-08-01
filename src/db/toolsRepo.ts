import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import type { Category, Tool, ToolFilter } from '../types';

const toolsCollection = collection(db, 'tools');
const categoriesCollection = collection(db, 'categories');

function toStringId(id: string | number): string {
  return String(id);
}

// Cache categories for enrichment
let categoriesCache: Map<string, Category> | null = null;
async function getCategoriesMap(): Promise<Map<string, Category>> {
  if (categoriesCache) return categoriesCache;
  try {
    const snap = await getDocs(categoriesCollection);
    const map = new Map<string, Category>();
    snap.docs.forEach(d => {
      const data = d.data() as any;
      map.set(d.id, { id: d.id as any, name: data.name, color: data.color, created_at: data.created_at?.toDate?.()?.toISOString?.() });
    });
    categoriesCache = map;
    return map;
  } catch {
    return new Map();
  }
}

function enrichTool(raw: any, id: string, catMap: Map<string, Category> | null): Tool {
  const catId = raw.category_id ? toStringId(raw.category_id) : null;
  let catName: string | null = null;
  let catColor: string | null = null;
  if (catId && catMap) {
    const c = catMap.get(catId);
    if (c) {
      catName = c.name;
      catColor = c.color;
    }
  }
  return {
    id: id as any,
    name: raw.name ?? '',
    serial_number: raw.serial_number ?? null,
    barcode: raw.barcode ?? raw.serial ?? null,
    category_id: catId ? (Number.isNaN(Number(catId)) ? (catId as any) : Number(catId)) : null,
    category_name: catName ?? raw.category_name ?? null,
    category_color: catColor ?? raw.category_color ?? null,
    description: raw.description ?? null,
    location: raw.location ?? null,
    total_quantity: Number(raw.total_quantity ?? 0),
    available_qty: Number(raw.available_qty ?? raw.total_quantity ?? 0),
    min_quantity: Number(raw.min_quantity ?? 0),
    image_uri: raw.image_uri ?? null,
    notes: raw.notes ?? null,
    is_deleted: raw.is_deleted ? 1 : 0,
    created_at: raw.created_at?.toDate?.()?.toISOString?.() ?? raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at?.toDate?.()?.toISOString?.() ?? raw.updated_at ?? new Date().toISOString(),
  };
}

function applyFilter(tools: Tool[], filter: ToolFilter = {}): Tool[] {
  let res = tools;
  if (filter.categoryId != null) {
    const catStr = toStringId(filter.categoryId);
    res = res.filter(t => {
      if (t.category_id == null) return false;
      return toStringId(t.category_id as any) === catStr;
    });
  }
  if (filter.location) {
    res = res.filter(t => t.location === filter.location);
  }
  if (filter.onlyAvailable) {
    res = res.filter(t => t.available_qty > 0);
  }
  if (filter.onlyLowStock) {
    res = res.filter(t => t.min_quantity > 0 && t.available_qty <= t.min_quantity);
  }
  if (filter.search) {
    const s = filter.search.toLowerCase();
    res = res.filter(t =>
      t.name.toLowerCase().includes(s) ||
      (t.serial_number && t.serial_number.toLowerCase().includes(s)) ||
      (t.barcode && t.barcode.toLowerCase().includes(s)) ||
      (t.location && t.location.toLowerCase().includes(s))
    );
  }
  // Exclude deleted
  res = res.filter(t => !t.is_deleted);
  return res.sort((a, b) => a.name.localeCompare(b.name));
}

export function subscribeTools(
  callback: (tools: Tool[]) => void,
  filter: ToolFilter = {}
): Unsubscribe {
  const q = query(toolsCollection, orderBy('name', 'asc'));
  return onSnapshot(q, async (snapshot) => {
    const catMap = await getCategoriesMap();
    let tools = snapshot.docs.map(d => enrichTool(d.data(), d.id, catMap));
    tools = applyFilter(tools, filter);
    callback(tools);
  }, (err) => {
    console.error('subscribeTools error', err);
    callback([]);
  });
}

export async function listTools(filter: ToolFilter = {}): Promise<Tool[]> {
  const catMap = await getCategoriesMap();
  const snap = await getDocs(query(toolsCollection, orderBy('name', 'asc')));
  let tools = snap.docs.map(d => enrichTool(d.data(), d.id, catMap));
  return applyFilter(tools, filter);
}

export async function getTool(id: string | number): Promise<Tool | null> {
  const sid = toStringId(id);
  if (!sid || sid === 'undefined') return null;
  const docRef = doc(db, 'tools', sid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const catMap = await getCategoriesMap();
  const data = snap.data();
  if (data.is_deleted) return null;
  return enrichTool(data, snap.id, catMap);
}

export async function findToolByCode(code: string): Promise<Tool | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  // Try barcode first
  let q = query(toolsCollection, where('barcode', '==', trimmed));
  let snap = await getDocs(q);
  if (!snap.empty) {
    const catMap = await getCategoriesMap();
    const d = snap.docs[0];
    if (!d.data().is_deleted) return enrichTool(d.data(), d.id, catMap);
  }
  // Try serial_number
  q = query(toolsCollection, where('serial_number', '==', trimmed));
  snap = await getDocs(q);
  if (!snap.empty) {
    const catMap = await getCategoriesMap();
    const d = snap.docs[0];
    if (!d.data().is_deleted) return enrichTool(d.data(), d.id, catMap);
  }
  // Fallback scan client side for barcode containing
  const all = await listTools();
  return all.find(t => t.barcode === trimmed || t.serial_number === trimmed) ?? null;
}

export interface ToolInput {
  name: string;
  serial_number?: string | null;
  barcode?: string | null;
  category_id?: number | string | null;
  description?: string | null;
  location?: string | null;
  total_quantity: number;
  min_quantity?: number;
  image_uri?: string | null;
  notes?: string | null;
}

async function logAudit(actor: string, action: string, entity: string, entity_id: string, details?: string) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor,
      action,
      entity,
      entity_id,
      details: details ?? null,
      created_at: serverTimestamp(),
    });
  } catch {}
}

export async function createTool(input: ToolInput, actor: string): Promise<string> {
  if (!input.name?.trim()) throw new Error('اسم الأداة مطلوب');
  const qty = Math.floor(Number(input.total_quantity));
  if (!Number.isFinite(qty) || qty < 0) throw new Error('الكمية غير صالحة');

  // Normalize category_id to string for Firestore
  let catId: string | null = null;
  if (input.category_id != null && String(input.category_id).trim() !== '') {
    catId = toStringId(input.category_id);
  }

  const docRef = await addDoc(toolsCollection, {
    name: input.name.trim(),
    serial_number: input.serial_number?.trim() || null,
    barcode: input.barcode?.trim() || null,
    category_id: catId,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    total_quantity: qty,
    available_qty: qty,
    min_quantity: Math.floor(Number(input.min_quantity ?? 0)),
    image_uri: input.image_uri || null,
    notes: input.notes?.trim() || null,
    is_deleted: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  categoriesCache = null; // invalidate
  await logAudit(actor, 'create', 'tool', docRef.id, input.name);
  return docRef.id;
}

export async function updateTool(id: string | number, input: ToolInput, actor: string): Promise<void> {
  const sid = toStringId(id);
  const docRef = doc(db, 'tools', sid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('الأداة غير موجودة');

  const existing = snap.data() as any;
  const newTotal = Math.floor(Number(input.total_quantity));
  if (!Number.isFinite(newTotal) || newTotal < 0) throw new Error('الكمية غير صالحة');

  // Preserve available difference if total changed
  const diff = newTotal - (existing.total_quantity ?? 0);
  const newAvailable = Math.max(0, (existing.available_qty ?? 0) + diff);

  let catId: string | null = null;
  if (input.category_id != null && String(input.category_id).trim() !== '') {
    catId = toStringId(input.category_id);
  }

  await updateDoc(docRef, {
    name: input.name.trim(),
    serial_number: input.serial_number?.trim() || null,
    barcode: input.barcode?.trim() || null,
    category_id: catId,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    total_quantity: newTotal,
    available_qty: newAvailable,
    min_quantity: Math.floor(Number(input.min_quantity ?? 0)),
    image_uri: input.image_uri || null,
    notes: input.notes?.trim() || null,
    updated_at: serverTimestamp(),
  });

  categoriesCache = null;
  await logAudit(actor, 'update', 'tool', sid, input.name);
}

export async function deleteTool(id: string | number, actor: string): Promise<void> {
  const sid = toStringId(id);
  const docRef = doc(db, 'tools', sid);
  await updateDoc(docRef, { is_deleted: true, updated_at: serverTimestamp() });
  await logAudit(actor, 'delete', 'tool', sid);
}

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCollection, orderBy('name', 'asc')));
  const list = snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id as any,
      name: data.name,
      color: data.color ?? '#0F766E',
      created_at: data.created_at?.toDate?.()?.toISOString?.() ?? undefined,
    } as Category;
  });
  // Update cache
  const map = new Map<string, Category>();
  list.forEach(c => map.set(toStringId(c.id), c));
  categoriesCache = map;
  return list;
}

export async function createCategory(name: string, color = '#0F766E'): Promise<string> {
  if (!name.trim()) throw new Error('اسم التصنيف مطلوب');
  const docRef = await addDoc(categoriesCollection, {
    name: name.trim(),
    color,
    created_at: serverTimestamp(),
  });
  categoriesCache = null;
  return docRef.id;
}

export async function deleteCategory(id: string | number): Promise<void> {
  const sid = toStringId(id);
  // First, unset category from tools that use it
  const q = query(toolsCollection, where('category_id', '==', sid));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => updateDoc(doc(db, 'tools', d.id), { category_id: null, updated_at: serverTimestamp() }));
  await Promise.all(promises);
  // Delete category doc
  await deleteDoc(doc(db, 'categories', sid));
  categoriesCache = null;
}

export async function listLocations(): Promise<string[]> {
  const snap = await getDocs(toolsCollection);
  const locations = new Set<string>();
  snap.docs.forEach(d => {
    const data = d.data() as any;
    if (data.location && !data.is_deleted) locations.add(String(data.location).trim());
  });
  return Array.from(locations).filter(Boolean).sort();
}

// For compatibility with old count queries in categories screen
export async function countToolsByCategory(categoryId: string | number): Promise<number> {
  const sid = toStringId(categoryId);
  try {
    // Try composite query, if index missing fallback to client filter
    const q = query(toolsCollection, where('category_id', '==', sid));
    const snap = await getDocs(q);
    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data() as any;
      if (!data.is_deleted) count++;
    });
    return count;
  } catch (e) {
    console.warn('countToolsByCategory fallback', e);
    try {
      const all = await listTools();
      return all.filter(t => String(t.category_id) === sid).length;
    } catch {
      return 0;
    }
  }
}
