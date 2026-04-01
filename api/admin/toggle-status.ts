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
      return res.status(500).json({ 
        error: 'Configuração do servidor incompleta: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.' 
      });
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Corpo da requisição inválido." });
      }
    }

    const { targetUserId, newStatus } = body;

    if (!targetUserId || !['active', 'blocked'].includes(newStatus)) {
      return res.status(400).json({ error: 'ID do usuário ou status inválido.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Erro ao atualizar status do perfil:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar o status do usuário.' });
    }

    return res.status(200).json({ success: true, newStatus });
  } catch (error: any) {
    console.error('Erro interno do servidor:', error);
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
