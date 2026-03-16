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
    face_descriptor float8[] NOT NULL,
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

-- Workers: public can read (needed for face matching on client), authenticated (admin) can do all
CREATE POLICY "public_read_workers" ON workers
    FOR SELECT TO anon USING (true);

CREATE POLICY "admin_insert_workers" ON workers
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update_workers" ON workers
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_workers" ON workers
    FOR DELETE TO authenticated USING (true);

-- Attendance logs: public can insert (time in/out) and read, authenticated can do all
CREATE POLICY "public_insert_attendance" ON attendance_logs
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "public_read_attendance" ON attendance_logs
    FOR SELECT TO anon USING (true);

CREATE POLICY "admin_all_attendance" ON attendance_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_logs_worker_id ON attendance_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_logged_at ON attendance_logs(logged_at);
