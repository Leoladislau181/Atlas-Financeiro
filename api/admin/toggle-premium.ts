export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("A variável SUPABASE_URL (ou VITE_SUPABASE_URL) não está configurada na Vercel");
    }
    if (!supabaseServiceKey) {
      throw new Error("A variável SUPABASE_SERVICE_ROLE_KEY não está configurada na Vercel");
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new Error("Token de autenticação não fornecido ou inválido.");
    }

    const token = authHeader.split(' ')[1];
    
    // Obter usuário via Supabase Auth API (REST)
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

    // Verificar se o usuário é admin
    const profileRes = await fetchDb(`profiles?id=eq.${user.id}&select=role`);
    const profileData = await profileRes.json();
    const callerProfile = profileData[0];

    if (!callerProfile || callerProfile.role !== 'admin') {
      throw new Error("Acesso negado. Apenas administradores podem realizar esta ação.");
    }

    // Parse body safely
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        throw new Error("Corpo da requisição inválido (não é um JSON válido).");
      }
    }

    const targetUserId = body?.targetUserId;
    const currentPremiumUntil = body?.currentPremiumUntil;
    const duration = body?.duration;

    if (!targetUserId) {
      throw new Error("ID do usuário alvo não fornecido.");
    }

    const isCurrentlyPremium = currentPremiumUntil && new Date(currentPremiumUntil) > new Date();
    
    let newPremiumUntil = null;
    
    // Se não for premium, ou se uma duração explícita for passada (para estender/sobrescrever)
    if (!isCurrentlyPremium || duration) {
      const now = Date.now();
      let addMs = 30 * 24 * 60 * 60 * 1000; // padrão 1 mês
      
      if (duration === 'week') {
        addMs = 7 * 24 * 60 * 60 * 1000;
      } else if (duration === 'month') {
        addMs = 30 * 24 * 60 * 60 * 1000;
      } else if (duration === 'year') {
        addMs = 365 * 24 * 60 * 60 * 1000;
      }
      
      newPremiumUntil = new Date(now + addMs).toISOString();
    } else {
      // Se for premium e nenhuma duração foi passada, revoga o premium
      newPremiumUntil = null;
    }

    // Atualizar status premium
    await fetchDb(`profiles?id=eq.${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ premium_until: newPremiumUntil })
    });

    return res.status(200).json({ success: true, newPremiumUntil });

  } catch (e: any) {
    console.error("[Admin API Toggle Error]:", e);
    
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
