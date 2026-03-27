# Sistema de Gestão Financeira e de Veículos

Este é um sistema completo para gestão financeira e controle de veículos, ideal para motoristas de aplicativo, gestores de frotas ou uso pessoal. A aplicação possui uma arquitetura Full-Stack (React + Node.js/Express) e permite o acompanhamento detalhado de receitas, despesas, e a administração de veículos, oferecendo dashboards interativos, relatórios exportáveis e leitura inteligente de recibos via IA.

## 1. Arquitetura do Projeto

O projeto utiliza uma arquitetura Full-Stack integrada:
- **Frontend:** Desenvolvido em React com Vite, Tailwind CSS e shadcn/ui.
- **Backend:** Servidor Node.js com Express (`server.ts`), que serve tanto a API quanto o frontend em produção.
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL).

### Funcionalidades de Backend (`server.ts`)
- **Leitor de Recibos com IA:** O endpoint `/api/parse-receipt` recebe imagens de recibos do frontend e utiliza a API do Google Gemini (`@google/genai`) no backend para extrair dados estruturados de forma segura, sem expor a chave da API no navegador.
- **Painel Administrativo:** Endpoints em `/api/admin/*` utilizam a chave `SUPABASE_SERVICE_ROLE_KEY` para realizar operações privilegiadas (como conceder status Premium a usuários) de forma segura, contornando o RLS (Row Level Security) apenas quando estritamente necessário e validando a permissão do usuário que faz a requisição.

## 2. Banco de Dados (Supabase)

O sistema utiliza as seguintes tabelas principais no Supabase. Certifique-se de criá-las no SQL Editor:

- `profiles`: Armazena os dados dos usuários, nível de acesso (`role`) e validade do plano premium (`premium_until`).
- `lancamentos`: Registra todas as transações financeiras (receitas e despesas).
- `categorias`: Armazena as categorias personalizadas de lançamentos de cada usuário.
- `vehicles`: Cadastro de veículos dos usuários.
- `manutencoes`: Histórico de manutenções vinculadas aos veículos.

*Nota: É fundamental configurar as políticas de RLS (Row Level Security) no Supabase para garantir que usuários comuns só possam ler e editar seus próprios dados.*

## 3. Variáveis de Ambiente Obrigatórias

Crie um arquivo `.env` na raiz do projeto (você pode copiar o `.env.example`) com as seguintes chaves:

```env
# URL do projeto Supabase (usada no front e no back)
VITE_SUPABASE_URL="sua_url_do_supabase_aqui"

# Chave pública anônima do Supabase (usada no front)
VITE_SUPABASE_ANON_KEY="sua_chave_anonima_do_supabase_aqui"

# Chave de Serviço do Supabase (usada no backend para ações admin)
SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role_aqui"

# Chave da API do Gemini (usada no backend para o leitor de recibos)
GEMINI_API_KEY="sua_chave_api_gemini_aqui"
```

## 4. Como rodar localmente (Fluxo Real)

O projeto utiliza o `server.ts` como ponto de entrada para rodar tanto a API quanto o frontend via middleware do Vite.

1. Clone o repositório.
2. Instale as dependências do projeto:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` com as suas chaves.
4. Inicie o servidor de desenvolvimento full-stack:
   ```bash
   npm run dev
   ```
   *O comando `npm run dev` executa o `server.ts` usando `tsx`. O servidor Express subirá na porta 3000, servindo as rotas da API (ex: `/api/parse-receipt`) e utilizando o Vite como middleware para compilar e servir o frontend React em tempo real na mesma porta.*
5. Acesse a aplicação no seu navegador em `http://localhost:3000`.

## 5. Como fazer build para Produção

Para gerar a versão otimizada e rodar o servidor em modo de produção:

1. Execute o comando de build (compila o frontend para a pasta `dist/`):
   ```bash
   npm run build
   ```
2. Inicie o servidor de produção:
   ```bash
   npm start
   ```
   *Em produção, o `server.ts` serve os arquivos estáticos da pasta `dist/` junto com as rotas da API.*

## 6. Dependências Externas

O projeto foi construído utilizando tecnologias modernas e bibliotecas consolidadas:

- **Frontend & Build:** [React 19](https://react.dev/) e [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) (com `clsx` e `tailwind-merge` para utilitários de classes)
- **Roteamento & Ícones:** [Lucide React](https://lucide.dev/) para ícones consistentes
- **Animações:** [Motion (Framer Motion)](https://motion.dev/) para transições de interface
- **Gráficos:** [Recharts](https://recharts.org/) para visualização de dados no dashboard
- **Backend as a Service (BaaS):** [@supabase/supabase-js](https://supabase.com/docs/reference/javascript/introduction) para banco de dados e autenticação
- **Manipulação de Datas:** [date-fns](https://date-fns.org/)
- **Exportação e Importação de Dados:**
  - `xlsx`: Para leitura e geração de arquivos Excel/CSV.
  - `jspdf` e `jspdf-autotable`: Para geração de relatórios em PDF.
  - `html2canvas`: Para capturas de tela em PDF.
- **Inteligência Artificial:** `@google/genai` para integrações com a API do Gemini.
