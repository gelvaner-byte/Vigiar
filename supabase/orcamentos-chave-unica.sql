-- Vigiar Orçamentos — corrige a duplicação de registros entre escritório e técnico
-- Rode em: Supabase Dashboard > SQL Editor > New query > Run
--
-- PROBLEMA: a chave da tabela era (user_id, colecao, id). Quando o técnico alterava um
-- registro criado pelo escritório, o banco criava uma SEGUNDA linha do mesmo registro.
-- Com duas cópias, o app tentava gravar as duas de uma vez e o Postgres recusava com
-- "ON CONFLICT DO UPDATE command cannot affect row a second time" (código 21000).
--
-- SOLUÇÃO: a chave passa a ser (colecao, id) — o registro é da empresa, não de quem criou.
-- Quem salvou por último continua guardado na coluna user_id.
--
-- Antes de mexer, o passo 1 guarda uma cópia integral da tabela.

-- 1) cópia de segurança (não apague esta tabela tão cedo)
create table if not exists orc_registros_backup_20260929 as
  select * from orc_registros;

-- 2) onde existir mais de uma cópia do mesmo registro, mantém a mais recente
delete from orc_registros a
using orc_registros b
where a.colecao = b.colecao
  and a.id = b.id
  and a.ctid <> b.ctid
  and (a.atualizado_em < b.atualizado_em
       or (a.atualizado_em = b.atualizado_em and a.ctid < b.ctid));

-- 3) troca a chave primária
alter table orc_registros drop constraint orc_registros_pkey;
alter table orc_registros add primary key (colecao, id);

-- 4) conferência: as duas contagens mostram quantas linhas ficaram
select (select count(*) from orc_registros_backup_20260929) as linhas_no_backup,
       (select count(*) from orc_registros) as linhas_agora;
