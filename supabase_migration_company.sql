-- Adicionar colunas de empresa que faltam na tabela faturas
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS company_name text default '';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS company_email text default '';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS company_creci text default '';
