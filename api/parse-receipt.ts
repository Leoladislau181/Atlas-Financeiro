import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const FREE_LIMIT = 5;
const PREMIUM_LIMIT = 50;

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Você precisa estar logado para ler recibos. Por favor, faça login novamente." });
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials missing in backend");
      return res.status(500).json({ error: "Ocorreu um problema de conexão com o servidor. Por favor, tente novamente mais tarde." });
    }

    const supabase = createClient(String(supabaseUrl), String(supabaseKey), {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Sua sessão expirou. Por favor, faça login novamente." });
    }

    const userId = user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("premium_until")
      .eq("id", userId)
      .single();

    const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();
    const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;

    const today = new Date().toISOString().split('T')[0];
    
    const { data: usageData } = await supabase
      .from('receipt_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const currentCount = usageData?.count || 0;

    if (currentCount >= limit) {
      return res.status(429).json({ 
        error: `Você atingiu o limite de leitura de recibos por hoje (${limit} recibos). Tente novamente amanhã${!isPremium ? ' ou assine o plano Premium para ler mais recibos' : ''}.` 
      });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Corpo da requisição inválido." });
      }
    }

    const { base64Image, mimeType } = body;

    if (!base64Image || typeof base64Image !== 'string' || base64Image.trim() === '') {
      return res.status(400).json({ error: "Por favor, envie uma imagem válida do recibo." });
    }

    if (!mimeType || typeof mimeType !== 'string' || mimeType.trim() === '') {
      return res.status(400).json({ error: "O formato da imagem não foi identificado." });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({ error: "Formato de imagem não suportado. Por favor, envie uma imagem JPG, PNG ou WEBP." });
    }

    const imageSizeBytes = (base64Image.length * 3) / 4;
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;

    if (imageSizeBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: "A imagem é muito grande. Por favor, envie uma imagem com menos de 5MB." });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "O serviço de inteligência artificial não está configurado corretamente. Entre em contato com o suporte." });
    }

    const ai = new GoogleGenAI({ apiKey: key });

    const prompt = `
      Analise este recibo/nota fiscal de posto de gasolina e extraia as seguintes informações:
      - valor: O valor total pago (apenas o número, use ponto para decimais).
      - data: A data da compra no formato YYYY-MM-DD.
      - litros: A quantidade de litros abastecidos (apenas o número, use ponto para decimais). Se não for combustível, retorne null.
      - preco_litro: O preço por litro (apenas o número, use ponto para decimais). Se não for combustível, retorne null.
      - tipo_combustivel: O tipo de combustível abastecido. Deve ser estritamente um dos seguintes valores: 'gasolina', 'etanol', 'diesel', 'gnv'. Se não for possível identificar ou não for combustível, retorne null.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            valor: {
              type: "NUMBER" as any,
              description: "Valor total do recibo",
            },
            data: {
              type: "STRING" as any,
              description: "Data do recibo no formato YYYY-MM-DD",
            },
            litros: {
              type: "NUMBER" as any,
              description: "Quantidade de litros abastecidos",
            },
            preco_litro: {
              type: "NUMBER" as any,
              description: "Preço por litro",
            },
            tipo_combustivel: {
              type: "STRING" as any,
              description: "Tipo de combustível (gasolina, etanol, diesel, gnv)",
            },
          },
          required: ["valor", "data"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Não conseguimos ler as informações deste recibo. Verifique se a imagem está nítida e tente novamente.");
    }

    await supabase
      .from('receipt_usage')
      .upsert({
        user_id: userId,
        date: today,
        count: currentCount + 1
      }, { onConflict: 'user_id, date' });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.text);
    } catch (e) {
      throw new Error("Erro ao processar a resposta da inteligência artificial.");
    }

    return res.status(200).json(parsedResponse);
  } catch (error: any) {
    console.error("[Parse Receipt Error]:", error);
    
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ 
        error: error.message || "Ocorreu um erro inesperado ao processar seu recibo. Por favor, tente novamente.",
        stack: error.stack
      });
    } else {
      return new Response(JSON.stringify({
        error: error.message || "Ocorreu um erro inesperado ao processar seu recibo. Por favor, tente novamente.",
        stack: error.stack
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
