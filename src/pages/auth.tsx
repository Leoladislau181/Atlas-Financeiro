import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Car, Wrench, FileText, BarChart3, ShieldCheck, CheckCircle2, ArrowRight, Gift, Sparkles } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    // Detect referral code in URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferredBy(ref);
      sessionStorage.setItem('atlas_referred_by', ref);
      // Clean URL for a cleaner experience
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check if it was previously saved in this session
      const savedRef = sessionStorage.getItem('atlas_referred_by');
      if (savedRef) {
        setReferredBy(savedRef);
      }
    }
  }, []);

  const features = [
    {
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      title: 'Gestão de Turnos',
      description: 'Registre sua jornada e saiba exatamente quanto ganha por hora trabalhada.'
    },
    {
      icon: <Car className="h-5 w-5 text-blue-500" />,
      title: 'Controle de Veículos',
      description: 'Gestão completa para frotas próprias ou alugadas com metas de lucro.'
    },
    {
      icon: <Wrench className="h-5 w-5 text-rose-500" />,
      title: 'Alertas de Manutenção',
      description: 'Avisos automáticos de troca de óleo e revisões baseados no seu odômetro.'
    },
    {
      icon: <FileText className="h-5 w-5 text-emerald-500" />,
      title: 'Relatórios Profissionais',
      description: 'Exporte seus dados em PDF ou Excel para uma análise financeira profunda.'
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-indigo-500" />,
      title: 'Dashboard em Tempo Real',
      description: 'Visão clara e instantânea do seu saldo, receitas e despesas mensais.'
    }
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um endereço de email válido.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              referred_by: referredBy || ''
            }
          }
        });
        if (error) throw error;
        setSuccess('Conta criada com sucesso! Verifique seu email ou faça login.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Erro de conexão. Verifique se as chaves do Supabase estão corretas nas configurações.');
      } else {
        setError(err.message || 'Ocorreu um erro.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um endereço de email válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Left Side: Features (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden flex-col justify-center p-12 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2000')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900/90 to-amber-900/20" />
        
        <div className="relative z-10 space-y-12 max-w-lg">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Atlas Financeiro</h1>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
              A gestão definitiva para quem vive na estrada.
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Controle seus ganhos, despesas e a saúde do seu veículo em um só lugar. Feito por motoristas, para motoristas.
            </p>
          </div>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-4 group">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-100">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/10 flex items-center gap-6">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <img
                  key={i}
                  className="inline-block h-10 w-10 rounded-full ring-2 ring-gray-900"
                  src={`https://i.pravatar.cc/100?img=${i + 10}`}
                  alt="User"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
            <p className="text-sm text-gray-400">
              <span className="text-white font-semibold">Centenas de motoristas</span> já estão otimizando seus ganhos.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg mb-4 overflow-hidden">
              <img 
                src="/logo.svg" 
                alt="Atlas Logo" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Atlas Financeiro
            </h2>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isSignUp ? 'Comece sua jornada' : 'Bem-vindo de volta'}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {isSignUp ? 'Crie sua conta gratuita e assuma o controle hoje.' : 'Acesse sua conta para gerenciar suas finanças.'}
            </p>
          </div>

          {isSignUp && referredBy && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 space-y-3 animate-in zoom-in duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:scale-110 transition-transform">
                <Sparkles className="h-20 w-20 text-amber-500" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-amber-900 dark:text-amber-300">Seja bem-vindo à elite! 🚀</h3>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
                Graças à indicação do seu amigo, você ganhou <strong>15 dias de Acesso Premium</strong> totalmente grátis para começar com o pé no acelerador!
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Bônus de Indicação Ativado</span>
              </div>
            </div>
          )}

          <Card className="border-none shadow-xl lg:shadow-none bg-white dark:bg-gray-950 rounded-2xl lg:rounded-none overflow-hidden">
            <CardContent className="p-6 sm:p-8 lg:p-0 lg:py-4">
              {!isConfigured && (
                <div className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                  <div className="mt-0.5">⚠️</div>
                  <div>
                    <strong className="block mb-1">Configuração Necessária:</strong> Conecte seu Supabase para habilitar o acesso ao sistema.
                  </div>
                </div>
              )}
              
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email profissional</label>
                  <Input
                    type="email"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sua senha</label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 focus:ring-amber-500"
                  />
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5" />
                    {success}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isSignUp ? 'Criar minha conta agora' : 'Entrar no Atlas'}
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </Button>
              </form>
              
              <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isSignUp ? 'Já possui uma conta?' : 'Novo por aqui?'}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="ml-2 font-bold text-amber-600 hover:text-amber-700 transition-colors underline underline-offset-4"
                  >
                    {isSignUp ? 'Fazer login' : 'Criar conta gratuita'}
                  </button>
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-6 opacity-50 grayscale">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_Cloud_Logo.svg/2560px-Google_Cloud_Logo.svg.png" alt="Google Cloud" className="h-4" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Logo_of_Supabase.svg/1200px-Logo_of_Supabase.svg.png" alt="Supabase" className="h-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
