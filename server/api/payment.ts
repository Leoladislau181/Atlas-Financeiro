import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const submitReceiptHandler = async (req: Request, res: Response) => {
  try {
    console.log('submitReceiptHandler called');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('supabaseUrl:', supabaseUrl ? 'set' : 'not set');
    console.log('supabaseServiceKey:', supabaseServiceKey ? 'set' : 'not set');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Configuração do servidor incompleta.');
      return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    }

    const authHeader = req.headers.authorization;
    console.log('authHeader:', authHeader ? 'set' : 'not set');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Token de autenticação não fornecido ou inválido.');
      return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Fetching user...');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Erro na autenticação do token:', authError?.message || 'Usuário não encontrado');
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    console.log('Autenticação confirmada para:', user.email);

    const { plan, receiptUrl } = req.body;
    if (!plan || !receiptUrl) {
      console.error('Dados incompletos no corpo da requisição:', { plan, receiptUrl });
      return res.status(400).json({ error: 'Plano e comprovante são obrigatórios.' });
    }

    // Fetch profile to check current premium status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('premium_until')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
    }

    const currentUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : 0;
    const wasPremium = user.user_metadata?.premium_status === 'pending'
      ? !!user.user_metadata?.was_premium_before_renewal
      : currentUntil > Date.now();
    
    console.log('Atualizando metadados para o usuário:', user.id);

    // Update user metadata
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        premium_status: 'pending',
        premium_plan: plan,
        payment_receipt_url: receiptUrl,
        was_premium_before_renewal: wasPremium
      }
    });

    if (metaError) {
      console.error('Erro ao atualizar metadados do usuário:', metaError);
      return res.status(500).json({ error: 'Erro ao salvar informações da assinatura.' });
    }
    
    console.log('Comprovante processado com sucesso para:', user.email);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
