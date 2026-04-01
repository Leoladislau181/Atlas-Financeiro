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

    // If already pending, preserve the original was_premium_before_renewal flag
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('premium_until')
      .eq('id', user.id)
      .single();

    const currentUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : 0;
    
    const wasPremium = user.user_metadata?.premium_status === 'pending'
      ? !!user.user_metadata?.was_premium_before_renewal
      : currentUntil > Date.now();

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

    return res.status(200).json({ success: true });
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
