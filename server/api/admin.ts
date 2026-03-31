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

export const toggleUserStatusHandler = async (req: Request, res: Response) => {
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

    const { targetUserId, newStatus } = req.body;

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
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const approvePaymentHandler = async (req: Request, res: Response) => {
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

    const { targetUserId, action, plan } = req.body;

    if (!targetUserId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'ID do usuário ou ação inválida.' });
    }

    // Update user metadata
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (getUserError || !targetUser.user) {
      return res.status(500).json({ error: 'Erro ao encontrar o usuário alvo.' });
    }

    let profileUpdateData: any = {};
    let metadataUpdateData: any = {};

    if (action === 'approve') {
      // Fetch current profile to get premium_until
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('premium_until')
        .eq('id', targetUserId)
        .single();
        
      const currentUntil = targetProfile?.premium_until ? new Date(targetProfile.premium_until).getTime() : 0;
      const now = Date.now();
      const wasPremium = targetUser.user.user_metadata?.was_premium_before_renewal;
      
      // If they were premium before and have a future premium_until, add to it. Otherwise add to now.
      const baseDate = wasPremium && currentUntil > now ? currentUntil : now;
      
      const days = plan === 'yearly' ? 365 : 30;
      const newPremiumUntil = new Date(baseDate + days * 24 * 60 * 60 * 1000).toISOString();
      
      profileUpdateData = {
        premium_until: newPremiumUntil,
      };
      
      metadataUpdateData = {
        premium_status: 'active',
        was_premium_before_renewal: null,
      };
    } else if (action === 'reject') {
      const wasPremium = targetUser.user.user_metadata?.was_premium_before_renewal;
      
      if (!wasPremium) {
        // Block access immediately if they weren't premium before
        profileUpdateData = {
          premium_until: null,
        };
      }
      
      metadataUpdateData = {
        premium_status: wasPremium ? 'active' : 'none',
        premium_plan: null,
        payment_receipt_url: null,
        was_premium_before_renewal: null,
      };
    }

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...targetUser.user.user_metadata,
        ...metadataUpdateData
      }
    });

    if (metaError) {
      console.error('Erro ao atualizar metadata do usuário:', metaError);
      return res.status(500).json({ error: 'Erro ao atualizar o status do pagamento do usuário.' });
    }

    // Update profile if there are changes
    if (Object.keys(profileUpdateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdateData)
        .eq('id', targetUserId);

      if (updateError) {
        console.error('Erro ao atualizar perfil do usuário:', updateError);
        return res.status(500).json({ error: 'Erro ao atualizar o perfil do usuário.' });
      }
    }

    return res.status(200).json({ success: true, action });
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
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return res.status(500).json({ error: 'Erro ao buscar usuários.', details: profilesError.message });
    }

    // Fetch auth users to get metadata
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authUsersError) {
      console.error('Erro ao buscar auth users:', authUsersError);
      // We can continue without metadata if it fails, but better to log it
    }

    // Merge profiles with auth metadata
    const users = profiles?.map(profile => {
      const authUser = authUsers?.users.find((u: any) => u.id === profile.id);
      return {
        ...profile,
        premium_status: authUser?.user_metadata?.premium_status || 'none',
        premium_plan: authUser?.user_metadata?.premium_plan || null,
        payment_receipt_url: authUser?.user_metadata?.payment_receipt_url || null,
      };
    }) || [];

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
