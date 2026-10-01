import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * Handler do endpoint /api/cron/keep-alive
 * 
 * Executa uma requisição de leitura leve no Supabase para renovar o timer
 * de inatividade de 7 dias do banco de dados no Supabase.
 */
export default async function handler(req: Request, res: Response) {
  const startTime = Date.now();

  // Permitir apenas requisições GET (e HEAD para verificação de liveness)
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      message: "Este endpoint aceita apenas requisições GET para execução do cron job.",
    });
  }

  // Prevenir cache na Vercel e proxies intermediários
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Content-Type", "application/json");

  // Proteção opcional por CRON_SECRET (recomendação oficial da Vercel para produção)
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Cabeçalho Authorization inválido ou ausente para a execução do Cron.",
      });
    }
  }

  // Obter credenciais do Supabase (com fallback para variáveis com prefixo VITE_)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      success: false,
      error: "MissingConfiguration",
      message: "Variáveis de ambiente do Supabase não configuradas no servidor (SUPABASE_URL e/ou SUPABASE_ANON_KEY).",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Instanciar o cliente Supabase sem persistência de sessão (otimizado para serverless)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Executa uma consulta leve de leitura no banco de dados
    // Tenta primeiro a tabela 'profiles' (comum neste projeto), buscando apenas 1 id
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: false })
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      // Mesmo com erro de permissão ou tabela (ex: RLS ativo para anon),
      // a requisição atingiu o PostgREST/PostgreSQL, mas registramos os detalhes
      return res.status(200).json({
        success: true,
        warning: "Database reached but query returned an application warning",
        message: "Ping enviado ao Supabase com sucesso. O banco de dados foi contatado.",
        latency_ms: latencyMs,
        supabase_error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supabase keep-alive executado com sucesso! Contador de inatividade reiniciado.",
      latency_ms: latencyMs,
      details: {
        queried_table: "profiles",
        rows_returned: data ? data.length : 0,
        total_count: count ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.error("[CRON KEEP-ALIVE] Erro ao conectar ao Supabase:", err);

    return res.status(500).json({
      success: false,
      error: "InternalServerError",
      message: err?.message || "Erro inesperado ao executar o ping no Supabase.",
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    });
  }
}
