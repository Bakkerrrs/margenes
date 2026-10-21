-- Migration: add Delivery Mode (last column of BDD1) to actividades
-- Run this in Supabase SQL Editor BEFORE importing an Excel that has the "Delivery Mode" column
-- Safe to run multiple times

ALTER TABLE actividades ADD COLUMN IF NOT EXISTS delivery_mode TEXT;
CREATE INDEX IF NOT EXISTS idx_actividades_delivery_mode ON actividades(delivery_mode);
