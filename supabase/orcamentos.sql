-- Vigiar Orçamentos e OS — tabela do banco (Supabase / Postgres)
-- Rode este script inteiro em: Supabase Dashboard > SQL Editor > New query > Run
-- Pode rodar mais de uma vez sem problema (não apaga nada).

-- Uma tabela guarda tudo do app de orçamentos:
--   colecao = 'orcamentos' | 'ordens' | 'config'
--   dados   = o registro completo (JSON), exatamente como o app usa
-- Exclusões são "lógicas" (excluido = true): nada some de verdade do banco,
-- então um registro apagado sem querer pode ser recuperado.

create table if not exists orc_registros (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  colecao text not null,
  id text not null,
  dados jsonb not null,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, colecao, id)
);

alter table orc_registros enable row level security;

drop policy if exists "select próprio - orc_registros" on orc_registros;
drop policy if exists "insert próprio - orc_registros" on orc_registros;
drop policy if exists "update próprio - orc_registros" on orc_registros;
create policy "select próprio - orc_registros" on orc_registros for select using (auth.uid() = user_id);
create policy "insert próprio - orc_registros" on orc_registros for insert with check (auth.uid() = user_id);
create policy "update próprio - orc_registros" on orc_registros for update using (auth.uid() = user_id);
-- Sem política de DELETE de propósito: o app nunca apaga linhas de verdade.

do $$
begin
  alter publication supabase_realtime add table orc_registros;
exception when duplicate_object then null;
end $$;
