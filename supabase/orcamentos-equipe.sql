-- Vigiar Orçamentos — acesso da equipe (escritório + técnicos)
-- Rode em: Supabase Dashboard > SQL Editor > New query > Run
-- Pode rodar mais de uma vez. NÃO apaga nada: só troca as regras de quem enxerga as linhas.
--
-- Qualquer login DA EMPRESA (usuário criado no seu projeto Supabase) vê e grava os mesmos
-- dados — é o que permite o técnico receber a agenda e devolver a OS concluída.
-- Quem não está logado continua sem ver nada. As tabelas do app financeiro não são tocadas.
--
-- Usa "auth.uid() is not null" (e não auth.role()), porque auth.role() não existe em
-- todas as versões do Supabase e, quando não existe, as regras passam a barrar TUDO:
-- o app abre vazio e não consegue salvar.

drop policy if exists "select próprio - orc_registros" on orc_registros;
drop policy if exists "insert próprio - orc_registros" on orc_registros;
drop policy if exists "update próprio - orc_registros" on orc_registros;
drop policy if exists "select equipe - orc_registros" on orc_registros;
drop policy if exists "insert equipe - orc_registros" on orc_registros;
drop policy if exists "update equipe - orc_registros" on orc_registros;

create policy "select equipe - orc_registros" on orc_registros
  for select using (auth.uid() is not null);
create policy "insert equipe - orc_registros" on orc_registros
  for insert with check (auth.uid() is not null);
create policy "update equipe - orc_registros" on orc_registros
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
-- Continua sem política de DELETE: ninguém apaga linha de verdade, nem por engano.

-- Conferência: deve listar as 3 políticas acima.
select policyname, cmd from pg_policies where tablename = 'orc_registros' order by cmd;
