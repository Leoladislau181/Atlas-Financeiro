-- ==============================================================================
-- REFERRAL AUTOMATION TRIGGERS AND FUNCTIONS
-- ==============================================================================
-- Este script cria as automações no banco de dados para o sistema "Indique e Ganhe".
-- Ele garante que:
-- 1. O usuário convidado ganhe 15 dias de Premium ao se cadastrar.
-- 2. O usuário que convidou ganhe 30 dias de Premium quando o convidado atingir 10 lançamentos.
-- ==============================================================================

-- 1. Adicionar coluna para rastrear se o prêmio já foi pago para o usuário que indicou
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referrer_rewarded BOOLEAN DEFAULT false;

-- ==============================================================================
-- REGRA 1: 15 DIAS DE PREMIUM PARA QUEM SE CADASTRA COM CONVITE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_profile_insert_referral()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
BEGIN
  -- Verifica se o usuário tem um código de indicação (referred_by) nos metadados do auth
  SELECT raw_user_meta_data->>'referred_by' INTO ref_code
  FROM auth.users
  WHERE id = NEW.id;

  -- Se foi indicado por alguém, ganha 15 dias de premium a partir de agora
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    UPDATE public.profiles
    SET premium_until = CURRENT_TIMESTAMP + INTERVAL '15 days'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o gatilho que roda sempre que um novo perfil é criado
DROP TRIGGER IF EXISTS on_profile_created_referral ON public.profiles;
CREATE TRIGGER on_profile_created_referral
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_insert_referral();


-- ==============================================================================
-- REGRA 2: 30 DIAS DE PREMIUM PARA QUEM INDICOU APÓS 10 LANÇAMENTOS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_lancamento_insert_referral()
RETURNS TRIGGER AS $$
DECLARE
  user_ref_code TEXT;
  referrer_id UUID;
  lancamentos_count INT;
  is_rewarded BOOLEAN;
  current_premium TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 1. Pega o código de quem indicou este usuário e verifica se já foi recompensado
  SELECT raw_user_meta_data->>'referred_by' INTO user_ref_code
  FROM auth.users
  WHERE id = NEW.user_id;

  SELECT referrer_rewarded INTO is_rewarded
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- 2. Se o usuário foi indicado E a recompensa ainda não foi paga
  IF user_ref_code IS NOT NULL AND user_ref_code != '' AND is_rewarded = false THEN
    
    -- 3. Conta quantos lançamentos este usuário já fez
    SELECT COUNT(*) INTO lancamentos_count
    FROM public.lancamentos
    WHERE user_id = NEW.user_id;

    -- 4. Se atingiu 10 lançamentos
    IF lancamentos_count >= 10 THEN
      
      -- Encontra o ID do usuário que fez a indicação (o dono do código)
      SELECT id INTO referrer_id
      FROM public.profiles
      WHERE referral_code = user_ref_code
      LIMIT 1;

      IF referrer_id IS NOT NULL THEN
        -- Pega a data atual de premium de quem indicou
        SELECT premium_until INTO current_premium
        FROM public.profiles
        WHERE id = referrer_id;

        -- Se ele já tem premium no futuro, soma 30 dias. Se não, dá 30 dias a partir de hoje.
        IF current_premium IS NOT NULL AND current_premium > CURRENT_TIMESTAMP THEN
          UPDATE public.profiles
          SET premium_until = current_premium + INTERVAL '30 days'
          WHERE id = referrer_id;
        ELSE
          UPDATE public.profiles
          SET premium_until = CURRENT_TIMESTAMP + INTERVAL '30 days'
          WHERE id = referrer_id;
        END IF;

        -- Marca que a recompensa já foi paga por este usuário (para não pagar de novo no 11º lançamento)
        UPDATE public.profiles
        SET referrer_rewarded = true
        WHERE id = NEW.user_id;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o gatilho que roda sempre que um novo lançamento é inserido
DROP TRIGGER IF EXISTS on_lancamento_created_referral ON public.lancamentos;
CREATE TRIGGER on_lancamento_created_referral
  AFTER INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_lancamento_insert_referral();
