import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // 1. Check de Env Vars
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("A variável SUPABASE_URL (ou VITE_SUPABASE_URL) não está configurada na Vercel");
    }
    if (!supabaseServiceKey) {
      throw new Error("A variável SUPABASE_SERVICE_ROLE_KEY não está configurada na Vercel");
    }

    // 2. Verificação de Autenticação
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new Error("Token de autenticação não fornecido ou inválido.");
    }
    
    const token = authHeader.split(' ')[1];
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error(`Token inválido ou expirado. Supabase Auth retornou erro.`);
    }

    // 4. Verificar se o usuário é admin
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      throw new Error("Acesso negado. Apenas administradores podem realizar esta ação.");
    }

    // 5. Queries Independentes
    
    // 5.1. Count na tabela profiles
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 5.2. Count na tabela profiles onde premium_until > now()
    const now = new Date().toISOString();
    const { count: premiumUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('premium_until', now);

    // 5.3. Count na tabela lancamentos
    const { count: totalTransactions } = await supabaseAdmin
      .from('lancamentos')
      .select('*', { count: 'exact', head: true });

    // 5.4. Select da lista de usuários na tabela profiles
    const { data: usersData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // 5.4.1 Fetch auth users to get metadata (premium_status, etc)
    const { data: authUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();
    const authUsers = authUsersData?.users || [];

    // 5.5. Fetch all vehicles and aggregate
    let vehicleCounts: Record<string, number> = {};
    try {
      const { data: allVehiclesData } = await supabaseAdmin.from('vehicles').select('user_id');
      if (allVehiclesData) {
        vehicleCounts = allVehiclesData.reduce((acc: any, v: any) => {
          const id = v.user_id;
          if (id) {
            acc[id] = (acc[id] || 0) + 1;
          }
          return acc;
        }, {});
      }
    } catch (e) {
      console.error('Error fetching vehicles:', e);
    }

    // 5.6. Fetch all lancamentos and aggregate
    let lancamentosCounts: Record<string, {count: number, total: number}> = {};
    try {
      const { data: allLancamentosData } = await supabaseAdmin.from('lancamentos').select('user_id, valor');
      if (allLancamentosData) {
        lancamentosCounts = allLancamentosData.reduce((acc: any, l: any) => {
          const id = l.user_id;
          const valor = l.valor;

          if (id) {
            acc[id] = acc[id] || { count: 0, total: 0 };
            acc[id].count += 1;
            acc[id].total += (valor || 0);
          }
          return acc;
        }, {});
      }
    } catch (e) {
      console.error('Error fetching lancamentos:', e);
    }

    const usersWithMetrics = (usersData || []).map((u: any) => {
      const vCount = vehicleCounts[u.id] || 0;
      const lData = lancamentosCounts[u.id] || { count: 0, total: 0 };
      
      const authUser = authUsers.find((au: any) => au.id === u.id);
      
      return {
        ...u,
        email: authUser?.email || '',
        premium_status: authUser?.user_metadata?.premium_status || 'none',
        payment_receipt_url: authUser?.user_metadata?.payment_receipt_url || null,
        premium_plan: authUser?.user_metadata?.premium_plan || null,
        vehicle_count: vCount,
        lancamentos_count: lData.count,
        total_movimentado: lData.total
      };
    });

    // 6. Retorno esperado
    return res.status(200).json({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      totalTransactions: totalTransactions || 0,
      users: usersWithMetrics || []
    });

  } catch (e: any) {
    // Estrutura de Log ultra-defensiva
    console.error("[Admin API Data Error]:", e);
    
    // Fallback if res.status is not a function
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ 
        error: e.message || "Erro desconhecido", 
        stack: e.stack 
      });
    } else {
      return new Response(JSON.stringify({
        error: e.message || "Erro desconhecido", 
        stack: e.stack 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
