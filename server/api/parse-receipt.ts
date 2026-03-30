import type { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Limits
const FREE_LIMIT = 5; // 5 receipts per day for free users
const PREMIUM_LIMIT = 50; // 50 receipts per day for premium users

export async function parseReceiptHandler(req: Request, res: Response) {
  try {
    // 1. Authentication Check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Você precisa estar logado para ler recibos. Por favor, faça login novamente." });
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials missing in backend");
      return res.status(500).json({ error: "Ocorreu um problema de conexão com o servidor. Por favor, tente novamente mais tarde." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Sua sessão expirou. Por favor, faça login novamente." });
    }

    const userId = user.id;

    // 2. Fetch User Profile to check Premium status
    const { data: profile } = await supabase
      .from("profiles")
      .select("premium_until, premium_status")
      .eq("id", userId)
      .single();

    const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();
    const isPending = profile?.premium_status === 'pending';
    
    if (isPending) {
      return res.status(403).json({ error: "A leitura de notas com IA estará disponível assim que seu pagamento for confirmado." });
    }

    const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;

    // 3. Rate Limiting Check (Persistent via Supabase)
    const today = new Date().toISOString().split('T')[0]; // UTC date YYYY-MM-DD
    
    const { data: usageData, error: usageError } = await supabase
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

    // 4. Validate Request Body
    const { base64Image, mimeType } = req.body;

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

    // Estimar o tamanho da imagem em bytes a partir da string base64
    const imageSizeBytes = (base64Image.length * 3) / 4;
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

    if (imageSizeBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: "A imagem é muito grande. Por favor, envie uma imagem com menos de 5MB." });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "O serviço de inteligência artificial não está configurado corretamente. Entre em contato com o suporte." });
    }

    // 5. Process with Gemini
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

    // 6. Increment Rate Limit Counter on Success (Persistent)
    await supabase
      .from('receipt_usage')
      .upsert({
        user_id: userId,
        date: today,
        count: currentCount + 1
      }, { onConflict: 'user_id, date' });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Error parsing receipt:", error);
    res.status(500).json({ error: error.message || "Ocorreu um erro inesperado ao processar seu recibo. Por favor, tente novamente." });
  }
}
