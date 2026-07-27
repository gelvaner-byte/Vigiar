# Vigiar — Gestão Financeira para Segurança Eletrônica

App web para controle financeiro de uma empresa de segurança eletrônica (venda de
produtos e serviços de instalação): despesas fixas, custos com fornecedores de
mercadorias, débitos a receber de clientes e valor do estoque. Protegido por senha
e com os dados sincronizados na nuvem — você acessa os mesmos dados de qualquer
dispositivo (celular, notebook, PC da loja).

## Tecnologias

- React 18 + Vite
- Tailwind CSS
- Lucide React (ícones)
- Supabase (banco de dados Postgres + autenticação + sincronização em tempo real)
- Vercel (hospedagem/deploy gratuito)

## Passo a passo — configurar do zero

Você precisa fazer as etapas 1 a 4 (contas gratuitas, feitas por você). Depois disso
o app já roda sincronizado com login.

### 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New Project**, dê um nome (ex: `vigiar`) e uma senha de banco (guarde
   essa senha, é só para uso administrativo, não é a senha de login do app).
3. Aguarde o projeto ser criado (leva ~1 minuto).

### 2. Rodar o script do banco de dados

1. No painel do Supabase, vá em **SQL Editor** > **New query**.
2. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) deste projeto, copie
   todo o conteúdo e cole no editor.
3. Clique em **Run**. Isso cria as 4 tabelas (despesas fixas, custos de mercadorias,
   débitos a receber, estoque) já com segurança configurada (cada login só vê os
   próprios dados) e sincronização em tempo real ligada.

### 3. Criar o usuário de login (a senha única do app)

1. No painel do Supabase, vá em **Authentication** > **Users** > **Add user** >
   **Create new user**.
2. Em **Email**, digite exatamente: `acesso@vigiar.app`
   (se quiser usar outro e-mail, pode — só lembre de repetir o mesmo valor na
   variável `VITE_APP_LOGIN_EMAIL` no passo 4).
3. Em **Password**, defina a senha que você vai usar para entrar no app. Essa senha
   fica só entre você e o Supabase — nunca é vista por mim.
4. Marque **Auto Confirm User** (para não precisar confirmar por e-mail) e salve.

### 4. Conectar o app ao Supabase

1. No painel do Supabase, vá em **Project Settings** > **API**.
2. Copie o **Project URL** e a chave **anon public**.
3. Na pasta do projeto, copie `.env.example` para um novo arquivo `.env`:

```bash
cp .env.example .env
```

4. Abra o `.env` e preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_APP_LOGIN_EMAIL=acesso@vigiar.app
```

### 5. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`, digite a senha criada no passo 3 e pronto.

## Publicar num link (Vercel — gratuito)

1. Suba este projeto para um repositório no GitHub (crie o repositório e faça o
   `git push` a partir da pasta do projeto).
2. Acesse [vercel.com](https://vercel.com), crie uma conta gratuita (dá pra entrar
   direto com o GitHub) e clique em **Add New Project**, escolhendo o repositório.
3. Em **Environment Variables**, adicione as 3 variáveis do seu `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_LOGIN_EMAIL`).
4. Clique em **Deploy**. Em ~1 minuto a Vercel te dá um link público, algo como
   `https://vigiar-seunome.vercel.app` — acessível de qualquer lugar, com login.
5. (Opcional, depois) Em **Project Settings** > **Domains** na Vercel, você pode
   apontar um domínio próprio (ex: `financeiro.suaempresa.com.br`) para esse link.

## Estrutura

```
src/
  components/
    Logo.jsx                 # Logo (ícone SVG laranja)
    Login.jsx                # Tela de senha única (Supabase Auth)
    Dashboard.jsx            # Cards de resumo financeiro
    DespesasFixas.jsx        # Aba: despesas fixas (aluguel, luz, água...)
    CustosMercadorias.jsx    # Aba: fornecedores/estoque de compra
    DebitosReceber.jsx       # Aba: clientes/parcelamentos a receber
    Estoque.jsx              # Aba: valor do estoque (equipamentos)
    StatusBadge.jsx          # Badge de status (Pago/Pendente/Recebido)
    FilterBar.jsx            # Busca + filtro de mês + filtro de status
  data/
    categories.js            # Categorias pré-definidas
  lib/
    supabaseClient.js        # Cliente Supabase + config de login
  utils/
    useSupabaseList.js       # Hook de dados (CRUD + sincronização em tempo real)
    dbCase.js                 # Conversão camelCase (JS) <-> snake_case (banco)
    format.js                 # Formatação de moeda/data e regras de mês/atraso
  App.jsx                     # Login gate + navegação por abas + layout
  main.jsx
  index.css
supabase/
  schema.sql                  # Script para criar as tabelas + segurança + realtime
```

## Observações

- Os dados ficam no Supabase (nuvem), sincronizados em tempo real entre qualquer
  dispositivo logado — não dependem mais do navegador.
- Clique no badge de status (Pago/Pendente/Recebido) para alternar rapidamente.
- Os cards do painel principal recalculam automaticamente com base em todos os
  registros cadastrados.
- O arquivo `.env` nunca deve ser commitado (já está no `.gitignore`) — ele contém
  a chave do seu projeto Supabase.
