-- Vigiar Orçamentos — acesso da equipe (escritório + técnicos)
-- Rode em: Supabase Dashboard > SQL Editor > New query > Run
-- Pode rodar mais de uma vez. NÃO apaga nada: só troca as regras de quem enxerga as linhas.
--
-- Antes: cada login via só as linhas criadas por ele mesmo.
-- Agora: qualquer login DA EMPRESA (usuário criado no seu projeto Supabase) vê os mesmos
-- dados — é o que permite o técnico receber a agenda e devolver a OS concluída.
-- Quem não está logado continua sem ver nada. As tabelas do app financeiro não são tocadas.

drop policy if exists "select próprio - orc_registros" on orc_registros;
drop policy if exists "insert próprio - orc_registros" on orc_registros;
drop policy if exists "update próprio - orc_registros" on orc_registros;
drop policy if exists "select equipe - orc_registros" on orc_registros;
drop policy if exists "insert equipe - orc_registros" on orc_registros;
drop policy if exists "update equipe - orc_registros" on orc_registros;

create policy "select equipe - orc_registros" on orc_registros
  for select using (auth.role() = 'authenticated');
create policy "insert equipe - orc_registros" on orc_registros
  for insert with check (auth.role() = 'authenticated');
create policy "update equipe - orc_registros" on orc_registros
  for update using (auth.role() = 'authenticated');
-- Continua sem política de DELETE: ninguém apaga linha de verdade, nem por engano.
