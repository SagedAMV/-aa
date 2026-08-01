/**
 * مخطط قاعدة البيانات المحلية (SQLite)
 * كل البيانات تُخزَّن على الجهاز — لا يوجد أي اتصال بخادم خارجي.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- المستخدمون (مدير المخزن / مستخدم عادي)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  full_name     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  salt          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',      -- 'admin' | 'user'
  can_withdraw_direct INTEGER NOT NULL DEFAULT 0,     -- سحب بدون موافقة
  can_add_tools       INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- التصنيفات
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#0F766E',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الأدوات
CREATE TABLE IF NOT EXISTS tools (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  serial_number  TEXT,
  barcode        TEXT,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description    TEXT,
  location       TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
  available_qty  INTEGER NOT NULL DEFAULT 1 CHECK (available_qty  >= 0),
  min_quantity   INTEGER NOT NULL DEFAULT 0,   -- حد التنبيه للكمية المنخفضة
  image_uri      TEXT,                          -- مسار محلي على الجهاز
  notes          TEXT,
  is_deleted     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tools_name     ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_serial   ON tools(serial_number);
CREATE INDEX IF NOT EXISTS idx_tools_barcode  ON tools(barcode);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_deleted  ON tools(is_deleted);

-- السحوبات
CREATE TABLE IF NOT EXISTS withdrawals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id          INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  withdrawn_by     TEXT    NOT NULL,   -- مستخدم المخزن المنفّذ
  recipient        TEXT    NOT NULL,   -- الجهة المستلمة
  reason           TEXT,
  status           TEXT    NOT NULL DEFAULT 'pending',
                   -- 'pending' | 'approved' | 'rejected' | 'returned' | 'partial'
  returned_qty     INTEGER NOT NULL DEFAULT 0,
  withdrawn_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  expected_return  TEXT,
  returned_at      TEXT,
  approved_by      TEXT,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_wd_tool   ON withdrawals(tool_id);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_wd_date   ON withdrawals(withdrawn_at);
CREATE INDEX IF NOT EXISTS idx_wd_expect ON withdrawals(expected_return);

-- الإضافات
CREATE TABLE IF NOT EXISTS additions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  added_by   TEXT    NOT NULL,
  source     TEXT,                     -- شراء / تبرع / إرجاع ...
  added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_add_tool ON additions(tool_id);
CREATE INDEX IF NOT EXISTS idx_add_date ON additions(added_at);

-- سجل الإجراءات (Audit Log)
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

-- الإعدادات (مفتاح/قيمة)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

/** التصنيفات الافتراضية عند أول تشغيل */
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'كهربائية', color: '#F59E0B' },
  { name: 'إلكترونية', color: '#3B82F6' },
  { name: 'يدوية', color: '#10B981' },
  { name: 'قياس', color: '#8B5CF6' },
  { name: 'سلامة', color: '#EF4444' },
  { name: 'أخرى', color: '#6B7280' },
];
