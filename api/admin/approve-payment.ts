import { createClient } from '@supabase/supabase-js';

// Polyfill for File in Node.js 18 environments (Vercel)
if (typeof global !== 'undefined' && typeof global.File === 'undefined') {
  global.File = class File extends Blob {
    name: string;
    lastModified: number;
    constructor(fileBits: any[], fileName: string, options?: any) {
      super(fileBits, options);
      this.name = fileName;
      this.lastModified = options?.lastModified || Date.now();
    }
  } as any;
}

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

    const { targetUserId, action, plan } = body;

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
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('premium_until')
        .eq('id', targetUserId)
        .single();
        
      const currentUntil = targetProfile?.premium_until ? new Date(targetProfile.premium_until).getTime() : 0;
      const now = Date.now();
      
      const baseDate = currentUntil > now ? currentUntil : now;
      
      const days = plan === 'yearly' ? 365 : 30;
      const newPremiumUntil = new Date(baseDate + days * 24 * 60 * 60 * 1000).toISOString();
      
      profileUpdateData = {
        premium_until: newPremiumUntil,
      };
      
      metadataUpdateData = {
        premium_status: 'active',
      };
    } else if (action === 'reject') {
      profileUpdateData = {
        premium_until: null,
      };
      
      metadataUpdateData = {
        premium_status: 'none',
        premium_plan: null,
        payment_receipt_url: null,
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

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Erro ao atualizar perfil do usuário:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar o perfil do usuário.' });
    }

    return res.status(200).json({ success: true, action });
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
