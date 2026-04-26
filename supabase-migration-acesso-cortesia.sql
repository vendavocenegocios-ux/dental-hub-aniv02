-- =============================================================
-- MIGRATION: Adiciona flag acesso_cortesia em profiles
-- Permite que admin libere acesso às automações sem assinatura paga
-- (útil para contas de teste/demo).
-- Rode este SQL no SQL Editor do Supabase externo.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acesso_cortesia boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_acesso_cortesia_idx
  ON public.profiles (acesso_cortesia)
  WHERE acesso_cortesia = true;
