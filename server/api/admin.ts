import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const togglePremiumHandler = async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Configuração do servidor incompleta: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.' 
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Create a Supabase client with the service role key to bypass RLS for the update
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user's token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    // Check if the caller is an admin
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }

    const { targetUserId, currentPremiumUntil } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'ID do usuário alvo não fornecido.' });
    }

    const isCurrentlyPremium = currentPremiumUntil && new Date(currentPremiumUntil) > new Date();
    const newPremiumUntil = isCurrentlyPremium ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Update the target user's profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ premium_until: newPremiumUntil })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar o status premium do usuário.' });
    }

    return res.status(200).json({ success: true, newPremiumUntil });
  } catch (error: any) {
    console.error('Erro interno do servidor:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const getAdminDataHandler = async (req: Request, res: Response) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Configuração do servidor incompleta: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.' 
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user's token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.', details: authError?.message });
    }

    // Check if the caller is an admin
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError) {
      return res.status(500).json({ error: 'Erro ao verificar perfil do usuário.', details: callerError.message });
    }

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }

    // Fetch all profiles
    const { data: users, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return res.status(500).json({ error: 'Erro ao buscar usuários.', details: profilesError.message });
    }

    // Fetch global metrics
    const { count: totalUsers, error: countUsersError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countUsersError) {
      return res.status(500).json({ error: 'Erro ao contar usuários.', details: countUsersError.message });
    }

    const { count: premiumUsers, error: countPremiumError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('premium_until', 'is', null)
      .gt('premium_until', new Date().toISOString());

    if (countPremiumError) {
      return res.status(500).json({ error: 'Erro ao contar usuários premium.', details: countPremiumError.message });
    }

    const { count: totalTransactions, error: countTransactionsError } = await supabaseAdmin
      .from('lancamentos')
      .select('*', { count: 'exact', head: true });

    if (countTransactionsError) {
      return res.status(500).json({ error: 'Erro ao contar lançamentos.', details: countTransactionsError.message });
    }

    return res.status(200).json({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      totalTransactions: totalTransactions || 0,
      users: users || []
    });
  } catch (error: any) {
    console.error('[Admin API Error] Erro interno do servidor:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
