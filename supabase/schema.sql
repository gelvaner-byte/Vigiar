-- Vigiar — schema do banco de dados (Supabase / Postgres)
-- Rode este script inteiro em: Supabase Dashboard > SQL Editor > New query > Run

create extension if not exists pgcrypto;

-- ============ TABELAS ============

create table if not exists despesas_fixas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  descricao text not null,
  categoria text not null,
  valor double precision not null,
  vencimento date not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create table if not exists custos_mercadorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fornecedor text not null,
  descricao text not null,
  valor double precision not null,
  vencimento date not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create table if not exists debitos_receber (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria text not null,
  cliente text not null,
  descricao text not null,
  valor_total double precision not null,
  num_parcelas integer not null default 1,
  valor_parcela double precision not null,
  vencimento date not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item text not null,
  categoria text not null,
  quantidade integer not null default 1,
  valor_unitario double precision not null,
  valor_total double precision not null,
  created_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
-- Cada usuário só enxerga e altera as próprias linhas (auth.uid() = user_id).

alter table despesas_fixas enable row level security;
alter table custos_mercadorias enable row level security;
alter table debitos_receber enable row level security;
alter table estoque enable row level security;

create policy "select próprio - despesas_fixas" on despesas_fixas for select using (auth.uid() = user_id);
create policy "insert próprio - despesas_fixas" on despesas_fixas for insert with check (auth.uid() = user_id);
create policy "update próprio - despesas_fixas" on despesas_fixas for update using (auth.uid() = user_id);
create policy "delete próprio - despesas_fixas" on despesas_fixas for delete using (auth.uid() = user_id);

create policy "select próprio - custos_mercadorias" on custos_mercadorias for select using (auth.uid() = user_id);
create policy "insert próprio - custos_mercadorias" on custos_mercadorias for insert with check (auth.uid() = user_id);
create policy "update próprio - custos_mercadorias" on custos_mercadorias for update using (auth.uid() = user_id);
create policy "delete próprio - custos_mercadorias" on custos_mercadorias for delete using (auth.uid() = user_id);

create policy "select próprio - debitos_receber" on debitos_receber for select using (auth.uid() = user_id);
create policy "insert próprio - debitos_receber" on debitos_receber for insert with check (auth.uid() = user_id);
create policy "update próprio - debitos_receber" on debitos_receber for update using (auth.uid() = user_id);
create policy "delete próprio - debitos_receber" on debitos_receber for delete using (auth.uid() = user_id);

create policy "select próprio - estoque" on estoque for select using (auth.uid() = user_id);
create policy "insert próprio - estoque" on estoque for insert with check (auth.uid() = user_id);
create policy "update próprio - estoque" on estoque for update using (auth.uid() = user_id);
create policy "delete próprio - estoque" on estoque for delete using (auth.uid() = user_id);

-- ============ REALTIME ============
-- Permite que uma alteração feita num dispositivo apareça automaticamente em outro.

alter publication supabase_realtime add table despesas_fixas;
alter publication supabase_realtime add table custos_mercadorias;
alter publication supabase_realtime add table debitos_receber;
alter publication supabase_realtime add table estoque;
