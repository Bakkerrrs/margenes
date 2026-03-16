-- Migration: Add new columns from SIICL_Planilla-Margenes_2025.xlsm
-- Run this in Supabase SQL Editor if tables already exist
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ============================================================
-- actividades: new columns from BDD1
-- ============================================================
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS irm TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS key_bu_final TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS wip NUMERIC DEFAULT 0;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS total_costo_corregido NUMERIC DEFAULT 0;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS uf_gestionable TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS total_prod_uf NUMERIC DEFAULT 0;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS dias_actividad NUMERIC DEFAULT 0;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS dias_gratuidad NUMERIC DEFAULT 0;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS adv_responsible_id TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS subproject TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS subproject_name TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS ops TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS aux_amr TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS subco TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS standarized_project TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS code_report TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS desc_report TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS starter_date TEXT;
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS finisher_date TEXT;

-- ============================================================
-- consultores: new columns from BDD2
-- ============================================================
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS emp_id2 TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS employee_type TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS responsible_id TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS activity_name TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS report_code TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS dias NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS fte NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS costo_diario NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS costo_mensual NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS ifs TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS sueldo_base_nominal NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS sueldo_liquido_teorico NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS prod_mensual_uf NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS prod_mensual_pesos NUMERIC DEFAULT 0;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS gratuidad TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS bu2 TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS subproject TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS tipologia TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS key_bu_final_2 TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS bu_jefatura TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS grupo_cliente TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS tipo_at TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS subco TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS standarized_project TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS code_report TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS mission TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS fecha_contratacion TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS unlink_date TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS end_of_month TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS yerie TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS bm TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS employee_id_2 TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS employee_name_2 TEXT;
ALTER TABLE consultores ADD COLUMN IF NOT EXISTS rut_2 TEXT;

-- ============================================================
-- New indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actividades_bu ON actividades(bu);
CREATE INDEX IF NOT EXISTS idx_actividades_pais ON actividades(pais);
CREATE INDEX IF NOT EXISTS idx_actividades_quarter ON actividades(quarter);
CREATE INDEX IF NOT EXISTS idx_consultores_employee ON consultores(employee_id);
CREATE INDEX IF NOT EXISTS idx_consultores_month ON consultores(month);
