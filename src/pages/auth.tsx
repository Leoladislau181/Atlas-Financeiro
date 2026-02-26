import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Conta criada com sucesso! Verifique seu email ou faça login.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
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
      alert('Email de recuperação enviado!');
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F59E0B] text-white text-2xl font-bold">
            A
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Atlas Financeiro
          </CardTitle>
          <p className="text-sm text-gray-500">
            {isSignUp ? 'Crie sua conta para começar' : 'Entre com suas credenciais'}
          </p>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <div className="mb-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 border border-yellow-200">
              <strong>Atenção:</strong> As variáveis de ambiente do Supabase não estão configuradas. O sistema não funcionará corretamente até que você adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
            </div>
          )}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-[#EF4444]">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Aguarde...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>
          
          <div className="mt-6 flex flex-col space-y-2 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-600 hover:text-[#F59E0B] hover:underline"
            >
              {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem conta? Criar Conta'}
            </button>
            {!isSignUp && (
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-gray-600 hover:text-[#F59E0B] hover:underline"
              >
                Recuperar Senha
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
