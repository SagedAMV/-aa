export type UserRole = 'admin' | 'user';

// مستويات الصلاحية للعمليات
export type PermissionLevel = 'none' | 'with_approval' | 'direct';

export interface UserPermissions {
  withdraw_level: PermissionLevel;
  addition_level: PermissionLevel;
  can_scan: boolean;
  can_view_reports: boolean;
  can_export: boolean;
  can_import: boolean;
  can_manage_categories: boolean;
  can_manage_tools: boolean;
  can_view_audit: boolean;
}

export interface User {
  id: string | number;
  username: string;
  full_name: string;
  role: UserRole;
  can_withdraw_direct: number;
  can_add_tools: number;
  is_active: number;
  created_at: string;
  // الحقول الجديدة للصلاحيات
  permissions?: UserPermissions;
  disabled_reason?: string;
  disabled_at?: string;
  disabled_by?: string;
}

export interface Category {
  id: string | number;
  name: string;
  color: string;
  created_at?: string;
}

// نوع الصرف: دائم أو مؤقت
export type WithdrawType = 'permanent' | 'temporary';

// حالة الأداة المُرجعة
export type ReturnedCondition = 'good' | 'needs_maintenance' | 'damaged';

// حالة الأداة العامة
export type ToolCondition = 'new' | 'used' | 'needs_maintenance' | 'damaged';

// ترتيب الأدوات
export type ToolSortBy = 'name' | 'quantity' | 'created' | 'updated';

export interface Tool {
  id: string | number;
  name: string;
  serial_number: string | null;
  barcode: string | null;
  category_id: string | number | null;
  category_name?: string | null;
  category_color?: string | null;
  description: string | null;
  location: string | null;
  total_quantity: number;
  available_qty: number;
  min_quantity: number;
  image_uri: string | null;
  notes: string | null;
  is_deleted: number;
  is_hidden?: number; // إخفاء عن المستخدمين العاديين
  condition?: ToolCondition; // حالة الأداة
  created_at: string;
  updated_at: string;
}

export type DisbursementStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'partial';

export interface Disbursement {
  id: string | number;
  tool_id: string | number;
  tool_name?: string;
  quantity: number;
  withdrawn_by: string;
  recipient: string;
  reason: string | null;
  status: DisbursementStatus;
  withdrawn_at: string;
  approved_by: string | null;
  notes: string | null;
  returned_qty?: number;
  expected_return?: string | null;
  returned_at?: string | null;
  // الحقول الجديدة
  withdraw_type?: WithdrawType; // دائم أو مؤقت
  return_condition?: ReturnedCondition; // حالة الأداة المُرجعة
}

export interface Addition {
  id: string | number;
  tool_id: string | number;
  tool_name?: string;
  quantity: number;
  added_by: string;
  source: string | null;
  added_at: string;
  notes: string | null;
  // الحقول الجديدة
  status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
}

export interface DashboardStats {
  totalTools: number;
  totalUnits: number;
  availableUnits: number;
  activeDisbursements: number;
  pendingApprovals: number;
  overdueCount: number;
  lowStockCount: number;
  additionsThisMonth: number;
}

export interface ToolFilter {
  search?: string;
  categoryId?: string | number | null;
  location?: string | null;
  onlyLowStock?: boolean;
  onlyAvailable?: boolean;
  includeHidden?: boolean; // للمدير لرؤية الأدوات المخفية
}

// أنواع سجل الإجراءات
export type AuditAction = 
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'withdraw'
  | 'withdraw_request'
  | 'withdraw_direct'
  | 'approve'
  | 'reject'
  | 'return'
  | 'addition'
  | 'addition_request'
  | 'change_password'
  | 'disable_user'
  | 'enable_user';

export interface AuditLog {
  id: string | number;
  actor: string;
  actor_id?: string | number;
  action: AuditAction | string;
  entity: string;
  entity_id: string | number;
  details: string | null;
  created_at: string;
}
