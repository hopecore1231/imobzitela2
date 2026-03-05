-- 1. Criar a tabela de Faturas
create table faturas (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text not null,
  client_doc text,
  client_email text,
  address text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  invoice_type text default 'Aluguel',
  value numeric not null default 0,
  additional_items jsonb default '[]'::jsonb,
  period_from date,
  period_to date,
  due_date date,
  emission_date date default CURRENT_DATE,
  status text default 'pendente',
  payment_method text default 'pix',
  notes text,
  is_custom_html boolean default false,
  raw_html_template text,
  client_logo text,
  paid_at timestamp with time zone,
  pagnet_tx_id text
);

-- 2. Configurar RLS (Row Level Security) - Permite leitura e escrita anônima para facilitar este projeto (já que não há login ainda)
-- Atenção: Num ambiente de produção real, use Autenticação do Supabase. Para manter o app funcionando como antes (sem login), usaremos tabelas públicas.
alter table faturas enable row level security;

create policy "Permitir leitura anônima de faturas publicas"
on faturas for select
using ( true );

create policy "Permitir insercao anonima"
on faturas for insert
with check ( true );

create policy "Permitir atualizacao anonima"
on faturas for update
using ( true );

create policy "Permitir exclusao anonima"
on faturas for delete
using ( true );
