-- ============================================================
-- Lampara Attendance System — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    employee_id text UNIQUE NOT NULL,
    position text DEFAULT '',
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    face_descriptor float8[] NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
    created_at timestamptz DEFAULT now()
);

-- Attendance logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('time_in', 'time_out')),
    logged_at timestamptz DEFAULT now(),
    date date DEFAULT current_date
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Workers: anon can read active workers (face matching) and their own record by email for login
CREATE POLICY "anon_read_active_workers" ON workers
    FOR SELECT TO anon USING (status = 'active');

-- Workers: anon can self-register (status must be 'pending')
CREATE POLICY "anon_insert_workers" ON workers
    FOR INSERT TO anon WITH CHECK (status = 'pending');

-- Admin can read ALL workers (including pending/rejected)
CREATE POLICY "admin_read_all_workers" ON workers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_insert_workers" ON workers
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update_workers" ON workers
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_workers" ON workers
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- If you already ran the old schema, run these ALTER statements
-- instead of recreating the table:
-- ============================================================
-- ALTER TABLE workers ADD COLUMN IF NOT EXISTS email text UNIQUE;
-- ALTER TABLE workers ADD COLUMN IF NOT EXISTS password_hash text;
-- ALTER TABLE workers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
--     CHECK (status IN ('pending', 'active', 'rejected'));
-- ALTER TABLE workers ALTER COLUMN face_descriptor DROP NOT NULL;
-- DROP POLICY IF EXISTS "public_read_workers" ON workers;
-- DROP POLICY IF EXISTS "admin_insert_workers" ON workers;
-- Then re-run the CREATE POLICY statements above.

-- Attendance logs: public can insert (time in/out) and read, authenticated can do all
CREATE POLICY "public_insert_attendance" ON attendance_logs
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "public_read_attendance" ON attendance_logs
    FOR SELECT TO anon USING (true);

CREATE POLICY "admin_all_attendance" ON attendance_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- RPC: Worker login (SECURITY DEFINER bypasses RLS so we can
-- return status for pending/rejected feedback)
-- ============================================================

CREATE OR REPLACE FUNCTION worker_login(p_employee_id text, p_password_hash text)
RETURNS TABLE(
    id uuid,
    name text,
    employee_id text,
    "position" text,
    face_descriptor float8[],
    face_descriptor_mobile float8[],
    status text,
    daily_rate numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
        SELECT w.id, w.name, w.employee_id, w.position,
               w.face_descriptor, w.face_descriptor_mobile, w.status,
               w.daily_rate
        FROM workers w
        WHERE w.employee_id = upper(trim(p_employee_id))
          AND w.password_hash = p_password_hash;
END;
$$;

-- ============================================================
-- Mobile face descriptor (Flutter app uses a separate column
-- since it uses a different TFLite model than the web face-api.js)
-- ============================================================
ALTER TABLE workers ADD COLUMN IF NOT EXISTS face_descriptor_mobile float8[];

-- Allow active workers to update their own mobile face descriptor via RPC
CREATE OR REPLACE FUNCTION save_mobile_face(p_worker_id uuid, p_descriptor float8[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE workers SET face_descriptor_mobile = p_descriptor WHERE id = p_worker_id;
END;
$$;

-- ============================================================
-- Daily rate for payroll (run this ALTER on existing DB)
-- ============================================================
ALTER TABLE workers ADD COLUMN IF NOT EXISTS daily_rate numeric DEFAULT 0;

-- ============================================================
-- Attendance log type: regular vs overtime
-- ============================================================
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS type text DEFAULT 'regular'
    CHECK (type IN ('regular', 'overtime'));

-- ============================================================
-- Payroll adjustments — one row per worker per pay period
-- Admin manually enters these values each month.
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
    month text NOT NULL,  -- format: 'YYYY-MM', e.g. '2025-02'
    sss numeric DEFAULT 0,
    philhealth numeric DEFAULT 0,
    pagibig numeric DEFAULT 0,
    cash_advance_deduction numeric DEFAULT 0,
    cash_advance_balance numeric DEFAULT 0,
    loans numeric DEFAULT 0,
    tax numeric DEFAULT 0,
    incentives numeric DEFAULT 0,
    night_differential numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(worker_id, month)
);

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_payroll_adjustments" ON payroll_adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_payroll_adjustments" ON payroll_adjustments
    FOR SELECT TO anon USING (true);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_worker_id ON attendance_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_logged_at ON attendance_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_worker_month ON payroll_adjustments(worker_id, month);
