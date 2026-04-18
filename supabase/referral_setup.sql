-- ==============================================================================
-- REFERRAL SYSTEM ENHANCEMENTS: CODE GENERATION
-- ==============================================================================

-- 1. Função para gerar um código de indicação único e curto
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Evitando caracteres ambíguos
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Garantir que a coluna referral_code tenha um valor padrão único ou seja preenchida via gatilho
-- Primeiro, preenchemos os usuários existentes que não têm código
DO $$
DECLARE
  profile_record RECORD;
  new_code TEXT;
BEGIN
  FOR profile_record IN SELECT id FROM public.profiles WHERE referral_code IS NULL OR referral_code = '' LOOP
    LOOP
      new_code := public.generate_referral_code();
      BEGIN
        UPDATE public.profiles SET referral_code = new_code WHERE id = profile_record.id;
        EXIT; -- Sai do loop interno se o update for bem-sucedido (sem conflito de unicidade se houvesse constraint)
      EXCEPTION WHEN OTHERS THEN
        -- Se houver erro de duplicidade (improvável com 8 chars), tenta gerar outro
        CONTINUE;
      END;
    END LOOP;
  END FOR;
END $$;

-- 3. Gatilho para gerar código automaticamente para novos perfis
CREATE OR REPLACE FUNCTION public.handle_new_profile_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_created_gen_code ON public.profiles;
CREATE TRIGGER on_profile_created_gen_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_referral_code();
