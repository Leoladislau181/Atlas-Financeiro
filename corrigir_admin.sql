-- 1. DESTROY ALL PREVIOUS POLICIES EXACTLY
-- (This removes exactly the broken ones that caused infinite recursion)

DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lancamentos' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lancamentos;', pol.policyname);
  END LOOP;
END $$;

-- 2. CREATE FRESH, 100% NON-RECURSIVE POLICIES
CREATE POLICY "Leitura_Perfil_Proprio" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Leitura_Total_Admins" ON public.profiles FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Atualizacao_Total_Admins" ON public.profiles FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Leitura_Lancamento_Proprio" ON public.lancamentos FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Leitura_Total_Lancamentos_Admins" ON public.lancamentos FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
