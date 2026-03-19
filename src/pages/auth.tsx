import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setDebugLogs(prev => [...prev, `${new Date().toISOString().substring(11,19)} - ${msg}`]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setReferredBy(refCode.toUpperCase());
      setIsSignUp(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebugLogs([]);
    addLog('Iniciando handleAuth...');

    try {
      if (isSignUp) {
        addLog('Chamando supabase.auth.signUp...');
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              referred_by: referredBy || null
            }
          }
        });
        addLog('Retorno de signUp: ' + (error ? 'Erro' : 'Sucesso'));
        if (error) throw error;
        setSuccess('Conta criada com sucesso! Verifique seu email ou faça login.');
        setIsSignUp(false);
      } else {
        addLog(`Teste de Fetch RAW para o Supabase Url: ${import.meta.env.VITE_SUPABASE_URL?.trim()}`);
        try {
            const rawRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL?.trim()}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            addLog(`REST API Respondeu com HTTP ${rawRes.status}`);
            const text = await rawRes.text();
            addLog(`Resposta: ${text.substring(0, 100)}`);
            
            // Agora tenta via Supabase
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch(fe) {
            addLog(`Falha total de rede: ${fe}`);
            throw fe;
        }
      }
    } catch (err: any) {
      addLog('Passou pelo Catch. Erro: ' + err.message);
      if (err.message === 'Failed to fetch') {
        setError('Erro de conexão. Verifique se as chaves do Supabase estão corretas nas configurações.');
      } else {
        setError(err.message || 'Ocorreu um erro.');
      }
    } finally {
      addLog('Finalizou. setLoading(false)');
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSuccess('Email de recuperação enviado!');
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 transition-colors duration-200">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg mb-6 overflow-hidden">
            <img 
              src="/logo.svg" 
              alt="Atlas Logo" 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Atlas Financeiro
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {isSignUp ? 'Crie sua conta para começar' : 'Entre com suas credenciais para acessar o sistema'}
          </p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border dark:border-gray-800">
          <CardContent className="p-8">
            {debugLogs.length > 0 && (
              <div className="mb-6 p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-lg overflow-y-auto max-h-40">
                <div className="font-bold text-white mb-2">Logs de Diagnóstico:</div>
                {debugLogs.map((lg, i) => <div key={i}>{lg}</div>)}
              </div>
            )}
            {!isConfigured && (
              <div className="mb-6 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-4 text-sm text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 flex items-start gap-3">
                <div className="mt-0.5">⚠️</div>
                <div>
                  <strong className="block mb-1">Atenção:</strong> As variáveis de ambiente do Supabase não estão configuradas. O sistema não funcionará corretamente até que você adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
                </div>
              </div>
            )}
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 bg-gray-50/50 dark:bg-gray-800/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Senha</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs font-medium text-[#F59E0B] hover:text-[#D97706] transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="h-12 bg-gray-50/50 dark:bg-gray-800/50"
                />
              </div>
              {isSignUp && referredBy && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Convite especial aplicado!</span>
                </div>
              )}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                  {success}
                </div>
              )}
              <Button type="submit" className="w-full h-12 text-base font-semibold bg-[#F59E0B] hover:bg-[#D97706] shadow-md hover:shadow-lg transition-all" disabled={loading}>
                {loading ? 'Aguarde...' : isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}
              </Button>
            </form>
            
            <div className="mt-8 text-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              </span>{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-semibold text-[#F59E0B] hover:text-[#D97706] transition-colors"
              >
                {isSignUp ? 'Faça login' : 'Crie agora'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
