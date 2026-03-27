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
    
    // 3. Obter usuário via Supabase Auth API (REST)
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Token inválido ou expirado. Supabase Auth retornou ${authRes.status}: ${errText}`);
    }
    
    const user = await authRes.json();
    if (!user || !user.id) {
      throw new Error("Usuário não encontrado no token.");
    }

    // Função auxiliar para chamadas ao PostgREST
    const fetchDb = async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          ...options.headers
        }
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro no banco de dados (${response.status} em /${path.split('?')[0]}): ${errText}`);
      }
      return response;
    };

    // 4. Verificar se o usuário é admin
    const profileRes = await fetchDb(`profiles?id=eq.${user.id}&select=role`);
    const profileData = await profileRes.json();
    const callerProfile = profileData[0];

    if (!callerProfile || callerProfile.role !== 'admin') {
      throw new Error("Acesso negado. Apenas administradores podem realizar esta ação.");
    }

    // 5. Queries Independentes usando REST API
    
    // 5.1. Count na tabela profiles
    const countUsersRes = await fetchDb('profiles?select=*', {
      headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
    });
    const countUsersRange = countUsersRes.headers.get('content-range');
    const totalUsers = countUsersRange ? parseInt(countUsersRange.split('/')[1]) : 0;

    // 5.2. Count na tabela profiles onde premium_until > now()
    const now = new Date().toISOString();
    const countPremiumRes = await fetchDb(`profiles?select=*&premium_until=gt.${now}`, {
      headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
    });
    const countPremiumRange = countPremiumRes.headers.get('content-range');
    const premiumUsers = countPremiumRange ? parseInt(countPremiumRange.split('/')[1]) : 0;

    // 5.3. Count na tabela lancamentos
    const countTransactionsRes = await fetchDb('lancamentos?select=*', {
      headers: { 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
    });
    const countTransactionsRange = countTransactionsRes.headers.get('content-range');
    const totalTransactions = countTransactionsRange ? parseInt(countTransactionsRange.split('/')[1]) : 0;

    // 5.4. Select da lista de usuários na tabela profiles
    const usersRes = await fetchDb('profiles?select=*&order=created_at.desc');
    const usersData = await usersRes.json();

    // 6. Retorno esperado
    return res.status(200).json({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      totalTransactions: totalTransactions || 0,
      users: usersData || []
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
