-- Adiciona o número (E.164 sem máscara) do WhatsApp atualmente conectado
-- à instância Evolution. Útil no painel admin para identificar visualmente
-- qual número está usando cada instância.
alter table public.whatsapp_instances
  add column if not exists owner_number text;
