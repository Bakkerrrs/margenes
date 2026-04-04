-- ============================================================
-- Migration: Create app_settings table for site password
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: allow read via anon key
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read app_settings" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow public update app_settings" ON app_settings
  FOR UPDATE USING (true);

CREATE POLICY "Allow public insert app_settings" ON app_settings
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Insert the site password (SHA-256 hash)
-- To generate: in browser console run:
--   async function h(p){const d=new TextEncoder().encode(p);const b=await crypto.subtle.digest('SHA-256',d);return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
--   await h('tu_password_aqui')
-- Then replace the hash below:
-- ============================================================

-- Example: password "margenes2025" → hash below
-- INSERT INTO app_settings (key, value) VALUES ('site_password', 'PEGA_TU_HASH_SHA256_AQUI');
