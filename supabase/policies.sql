-- ==============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Este script configura a segurança do banco de dados para garantir que cada
-- usuário só tenha acesso aos seus próprios dados, além de criar regras para
-- administradores e para o armazenamento de fotos (avatars).
-- ==============================================================================

-- 1. Criar função auxiliar segura para verificar se o usuário é admin
-- Usamos SECURITY DEFINER para evitar recursão infinita ao checar a tabela profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Habilitar RLS em todas as tabelas do aplicativo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS PARA A TABELA: profiles
-- ==============================================================================
-- Usuários podem ver e editar o próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());


-- ==============================================================================
-- POLÍTICAS PARA A TABELA: categorias
-- ==============================================================================
-- Usuários podem ver suas próprias categorias ou as categorias padrão do sistema
CREATE POLICY "Users can view own or system categories" ON public.categorias
  FOR SELECT USING (auth.uid() = user_id OR is_system_default = true);

CREATE POLICY "Users can insert own categories" ON public.categorias
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categorias
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categorias
  FOR DELETE USING (auth.uid() = user_id);

-- Admins podem ver todas as categorias
CREATE POLICY "Admins can view all categories" ON public.categorias
  FOR SELECT USING (public.is_admin());


-- ==============================================================================
-- POLÍTICAS PARA A TABELA: vehicles
-- ==============================================================================
CREATE POLICY "Users can view own vehicles" ON public.vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles" ON public.vehicles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles" ON public.vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- Admins podem ver todos os veículos
CREATE POLICY "Admins can view all vehicles" ON public.vehicles
  FOR SELECT USING (public.is_admin());


-- ==============================================================================
-- POLÍTICAS PARA A TABELA: manutencoes
-- ==============================================================================
CREATE POLICY "Users can view own manutencoes" ON public.manutencoes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manutencoes" ON public.manutencoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manutencoes" ON public.manutencoes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own manutencoes" ON public.manutencoes
  FOR DELETE USING (auth.uid() = user_id);

-- Admins podem ver todas as manutenções
CREATE POLICY "Admins can view all manutencoes" ON public.manutencoes
  FOR SELECT USING (public.is_admin());


-- ==============================================================================
-- POLÍTICAS PARA A TABELA: lancamentos
-- ==============================================================================
CREATE POLICY "Users can view own lancamentos" ON public.lancamentos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lancamentos" ON public.lancamentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lancamentos" ON public.lancamentos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lancamentos" ON public.lancamentos
  FOR DELETE USING (auth.uid() = user_id);

-- Admins podem ver todos os lançamentos
CREATE POLICY "Admins can view all lancamentos" ON public.lancamentos
  FOR SELECT USING (public.is_admin());


-- ==============================================================================
-- POLÍTICAS PARA O STORAGE (BUCKET: avatars)
-- ==============================================================================
-- Suposição: O bucket 'avatars' já foi criado no painel do Supabase.
-- As imagens de avatar são públicas para leitura
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Usuários só podem fazer upload, atualizar ou deletar arquivos na sua própria pasta (cujo nome é o seu ID)
CREATE POLICY "Users can upload own avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
