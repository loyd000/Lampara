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

CREATE OR REPLACE FUNCTION worker_login(p_email text, p_password_hash text)
RETURNS TABLE(
    id uuid,
    name text,
    employee_id text,
    "position" text,
    face_descriptor float8[],
    status text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
        SELECT w.id, w.name, w.employee_id, w.position, w.face_descriptor, w.status
        FROM workers w
        WHERE w.email = lower(trim(p_email))
          AND w.password_hash = p_password_hash;
END;
$$;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_worker_id ON attendance_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_logged_at ON attendance_logs(logged_at);
