-- Ativar Segurança RLS (se já não estiver)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- 1. Acesso do usuário ao próprio perfil
DROP POLICY IF EXISTS "Usuário pode ver o próprio perfil" ON public.profiles;
CREATE POLICY "Usuário pode ver o próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- 2. Acesso de Leitura Total para Administradores
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Administradores podem ver todos os perfis" ON public.profiles FOR SELECT USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. Acesso de Edição Total para Administradores (Mudar permissões e Premium)
DROP POLICY IF EXISTS "Administradores podem atualizar perfis" ON public.profiles;
CREATE POLICY "Administradores podem atualizar perfis" ON public.profiles FOR UPDATE USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 4. Administradores podem visualizar todos os lançamentos para estatísticas
DROP POLICY IF EXISTS "Administradores podem ver todos os lançamentos" ON public.lancamentos;
CREATE POLICY "Administradores podem ver todos os lançamentos" ON public.lancamentos FOR SELECT USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
