-- Schema for Panel de Márgenes SIICL
-- Run this in your Supabase SQL Editor
-- Updated to include ALL columns from SIICL_Planilla-Margenes_2025.xlsm

-- ============================================================
-- Drop existing tables (uncomment if you need to recreate)
-- ============================================================
-- DROP TABLE IF EXISTS consultores;
-- DROP TABLE IF EXISTS actividades;

-- ============================================================
-- Table: actividades (BDD1 sheet)
-- ============================================================
CREATE TABLE IF NOT EXISTS actividades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Core fields
  fy TEXT NOT NULL,                          -- Ejercicio (e.g. '2023-2024')
  month TEXT NOT NULL,                       -- Month (e.g. '2023-04')
  customer TEXT NOT NULL,                    -- Customer
  act_short TEXT NOT NULL,                   -- Activity Short Name (e.g. 'SGC0002701.01.P005')
  act_desc TEXT NOT NULL,                    -- Activity Description

  -- Classification
  irm TEXT,                                  -- IRM vs2 / Income Recognition Method (e.g. 'T & M', '[R]-FP')
  tipo_at TEXT,                              -- Tipo-AT (e.g. 'RESTO')
  bu TEXT,                                   -- BU FINAL 2
  key_bu_final TEXT,                         -- Key BU FINAL (composite key)
  jefatura TEXT,                             -- Jefatura (manager)

  -- Financial
  wip NUMERIC DEFAULT 0,                    -- End of period WIP
  billing NUMERIC DEFAULT 0,                -- Total Facturacion mensual
  prod NUMERIC DEFAULT 0,                   -- Total Monthly Prod
  cost NUMERIC DEFAULT 0,                   -- Total Monthly costs
  margin NUMERIC DEFAULT 0,                 -- Total Monthly Margen (decimal: 0.34 = 34%)
  total_costo_corregido NUMERIC DEFAULT 0,  -- Total Costo Corregido
  uf_gestionable TEXT,                       -- UF Gestionable
  total_prod_uf NUMERIC DEFAULT 0,          -- Total_Prod_UF

  -- Days
  dias_imputados NUMERIC DEFAULT 0,         -- Total dias imputados
  dias_actividad NUMERIC DEFAULT 0,         -- Dias Actividad
  dias_gratuidad NUMERIC DEFAULT 0,         -- Dias Gratuidad
  working_days INTEGER DEFAULT 0,           -- Working Days

  -- Project hierarchy
  adv_responsible_id TEXT,                   -- ADV - Responsible ID
  project TEXT,                              -- Project code
  project_name TEXT,                         -- Project name
  subproject TEXT,                           -- Subproject code
  subproject_name TEXT,                      -- Subproject name

  -- Additional classification
  ops TEXT,                                  -- OPS
  aux_amr TEXT,                              -- AUX_AMR
  quarter TEXT,                              -- Quarter (e.g. 'Q2-2023')
  pais TEXT,                                 -- Pais (country)
  subco TEXT,                                -- Subco
  standarized_project TEXT,                  -- Standarized Project

  -- Reporting
  code_report TEXT,                          -- Code Report
  desc_report TEXT,                          -- Desc Report

  -- Dates
  starter_date TEXT,                         -- Starter Date
  finisher_date TEXT                         -- Finisher Date
);

-- ============================================================
-- Table: consultores (BDD2 sheet)
-- ============================================================
CREATE TABLE IF NOT EXISTS consultores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Employee identification
  rut TEXT,                                  -- RUT
  emp_id2 TEXT,                              -- Emp ID2 (Unique)
  employee_id TEXT,                          -- Employee ID
  employee_name TEXT,                        -- Employee Name
  employee_type TEXT,                        -- Employee Type (e.g. 'Contractor')

  -- Management
  jefe_directo TEXT,                         -- Jefe directo
  responsible_id TEXT,                       -- Responsible ID

  -- Time & assignment
  month TEXT NOT NULL,                       -- Month
  act_short TEXT NOT NULL,                   -- Activity Short Name
  activity_name TEXT,                        -- Activity Name
  profesional TEXT NOT NULL,                 -- Employee Name (display)
  report_code TEXT,                          -- Report code
  hours NUMERIC DEFAULT 0,                  -- Hours
  dias NUMERIC DEFAULT 0,                   -- Dias
  working_days INTEGER DEFAULT 0,           -- Working Days
  fte NUMERIC DEFAULT 0,                    -- FTE2

  -- Financial
  costo_diario NUMERIC DEFAULT 0,           -- Costo diario
  costo_mensual NUMERIC DEFAULT 0,          -- Costo mensual
  ifs TEXT,                                  -- IFS
  sueldo_base_nominal NUMERIC DEFAULT 0,    -- Sueldo Base Nominal
  sueldo_liquido_teorico NUMERIC DEFAULT 0, -- Sueldo Liquido Teoricó
  prod_mensual_uf NUMERIC DEFAULT 0,        -- Producción mensual (UF)
  prod_mensual_pesos NUMERIC DEFAULT 0,     -- Producción mensual (Pesos chilenos)
  gratuidad TEXT,                            -- Gratuidad

  -- Project hierarchy
  cliente TEXT,                              -- Cliente
  bu2 TEXT,                                  -- BU2
  project TEXT,                              -- Project
  subproject TEXT,                           -- Sub-project
  project_name TEXT,                         -- Project name
  tipologia TEXT,                            -- Tipologia

  -- Classification
  key_bu_final_2 TEXT,                       -- Key BU FINAL 2
  bu_jefatura TEXT,                          -- BU-Jefatura
  grupo_cliente TEXT,                        -- Grupo Cliente
  tipo_at TEXT,                              -- TipoAT
  pais TEXT,                                 -- Pais
  subco TEXT,                                -- Subco
  standarized_project TEXT,                  -- Standarized Project
  code_report TEXT,                          -- Code Report
  mission TEXT,                              -- Mission

  -- Dates
  fecha_contratacion TEXT,                   -- Fecha de contratación
  unlink_date TEXT,                          -- Unlink Date
  end_of_month TEXT,                         -- End of month

  -- Additional
  yerie TEXT,                                -- Yerie
  bm TEXT,                                   -- BM
  employee_id_2 TEXT,                        -- Employee ID 2
  employee_name_2 TEXT,                      -- Employee Name 2
  rut_2 TEXT                                 -- RUT 2
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actividades_fy ON actividades(fy);
CREATE INDEX IF NOT EXISTS idx_actividades_month ON actividades(month);
CREATE INDEX IF NOT EXISTS idx_actividades_fy_month ON actividades(fy, month);
CREATE INDEX IF NOT EXISTS idx_actividades_bu ON actividades(bu);
CREATE INDEX IF NOT EXISTS idx_actividades_pais ON actividades(pais);
CREATE INDEX IF NOT EXISTS idx_actividades_quarter ON actividades(quarter);

CREATE INDEX IF NOT EXISTS idx_consultores_act_month ON consultores(act_short, month);
CREATE INDEX IF NOT EXISTS idx_consultores_employee ON consultores(employee_id);
CREATE INDEX IF NOT EXISTS idx_consultores_month ON consultores(month);

-- ============================================================
-- Row Level Security (public read access via anon key)
-- ============================================================
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read actividades" ON actividades
  FOR SELECT USING (true);

CREATE POLICY "Allow public read consultores" ON consultores
  FOR SELECT USING (true);
