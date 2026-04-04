-- ============================================================
-- Migration: Create app_users table for SSO user management
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,              -- Clerk user ID
  email TEXT UNIQUE NOT NULL,                 -- Email from Clerk (e.g. user@siigroup.cl)
  name TEXT,                                  -- Display name
  role TEXT NOT NULL DEFAULT 'user'           -- 'user' or 'admin'
    CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active'       -- 'active' or 'inactive'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),       -- First login timestamp
  last_login TIMESTAMPTZ DEFAULT now()        -- Last login timestamp
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_users_clerk_id ON app_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);

-- RLS: allow read/write via anon key (app manages access via Clerk auth)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read app_users" ON app_users
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert app_users" ON app_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update app_users" ON app_users
  FOR UPDATE USING (true);
