export type UserRole = 'admin' | 'user';

export interface User {
  id: string | number;
  username: string;
  full_name: string;
  role: UserRole;
  can_withdraw_direct: number;
  can_add_tools: number;
  is_active: number;
  created_at: string;
}

export interface Category {
  id: string | number;
  name: string;
  color: string;
  created_at?: string;
}

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
}
