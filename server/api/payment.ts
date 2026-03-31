import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const submitReceiptHandler = async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const { plan, receiptUrl } = req.body;

    if (!plan || !receiptUrl) {
      return res.status(400).json({ error: 'Plano e comprovante são obrigatórios.' });
    }

    // Grant 3 days of pending premium if they don't already have more
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('premium_until')
      .eq('id', user.id)
      .single();

    const currentUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : 0;
    const pendingUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    let newUntil = pendingUntil.toISOString();
    
    // If already pending, preserve the original was_premium_before_renewal flag
    const wasPremium = user.user_metadata?.premium_status === 'pending'
      ? !!user.user_metadata?.was_premium_before_renewal
      : currentUntil > Date.now();

    if (currentUntil > pendingUntil.getTime()) {
      newUntil = new Date(currentUntil).toISOString();
    }
    
    // Update user metadata
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        premium_status: 'pending',
        premium_plan: plan,
        payment_receipt_url: receiptUrl,
        was_premium_before_renewal: wasPremium
      }
    });

    if (metaError) {
      console.error('Erro ao atualizar metadata:', metaError);
      return res.status(500).json({ error: 'Erro ao salvar comprovante.' });
    }
    
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ premium_until: newUntil })
      .eq('id', user.id);

    if (profileError) {
      console.error('Erro ao atualizar perfil:', profileError);
      return res.status(500).json({ error: 'Erro ao liberar acesso temporário.' });
    }

    return res.status(200).json({ success: true, premium_until: newUntil });
  } catch (error: any) {
    console.error('Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
