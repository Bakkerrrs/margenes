-- Schema for Panel de Márgenes SIICL
-- Run this in your Supabase SQL Editor

-- Table: actividades
-- Stores all activity margin data (previously RAW.a)
CREATE TABLE IF NOT EXISTS actividades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month TEXT NOT NULL,           -- e.g. '2023-04'
  customer TEXT NOT NULL,        -- company name
  act_short TEXT NOT NULL,       -- activity code e.g. 'SGC0002701.01.P005'
  act_desc TEXT NOT NULL,        -- activity description
  tipo_at TEXT,                  -- activity type
  bu TEXT,                       -- business unit
  prod NUMERIC DEFAULT 0,       -- production value
  cost NUMERIC DEFAULT 0,       -- cost value
  margin NUMERIC DEFAULT 0,     -- margin percentage (decimal, e.g. 0.34 = 34%)
  billing NUMERIC DEFAULT 0,    -- billing value
  jefatura TEXT,                 -- manager
  dias_imputados NUMERIC DEFAULT 0,  -- imputed days
  working_days INTEGER DEFAULT 0,    -- working days in month
  fy TEXT NOT NULL               -- fiscal year e.g. '2023-2024'
);

-- Table: consultores
-- Stores consultant assignments per activity/month (previously RAW.c)
CREATE TABLE IF NOT EXISTS consultores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  act_short TEXT NOT NULL,       -- activity code
  month TEXT NOT NULL,           -- e.g. '2023-01'
  profesional TEXT NOT NULL,     -- consultant name
  jefe_directo TEXT              -- direct manager
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_actividades_fy ON actividades(fy);
CREATE INDEX IF NOT EXISTS idx_actividades_month ON actividades(month);
CREATE INDEX IF NOT EXISTS idx_actividades_fy_month ON actividades(fy, month);
CREATE INDEX IF NOT EXISTS idx_consultores_act_month ON consultores(act_short, month);

-- Enable Row Level Security (public read access via anon key)
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read actividades" ON actividades
  FOR SELECT USING (true);

CREATE POLICY "Allow public read consultores" ON consultores
  FOR SELECT USING (true);
