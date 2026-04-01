import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
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

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Corpo da requisição inválido." });
      }
    }

    const { plan, receiptUrl } = body;

    if (!plan || !receiptUrl) {
      return res.status(400).json({ error: 'Plano e comprovante são obrigatórios.' });
    }

    // Update user metadata
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        premium_status: 'pending',
        premium_plan: plan,
        payment_receipt_url: receiptUrl
      }
    });

    if (metaError) {
      console.error('Erro ao atualizar metadata:', metaError);
      return res.status(500).json({ error: 'Erro ao salvar comprovante.' });
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
    if (currentUntil > pendingUntil.getTime()) {
      newUntil = new Date(currentUntil).toISOString();
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
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    } else {
      return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
