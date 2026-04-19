import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { isPremium, parseLocalDate, cn } from '@/lib/utils';
import { Shield, ChevronLeft, Star, Gift, Copy, MessageCircle, Users, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlanoIndicacoesPageProps {
  user: User;
  onBack: () => void;
  onNavigateToPremium: () => void;
}

export function PlanoIndicacoesPage({ user, onBack, onNavigateToPremium }: PlanoIndicacoesPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'plano' | 'indicacoes'>('plano');
  const [referredUsers, setReferredUsers] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [referralStats, setReferralStats] = useState({ totalActive: 0, totalDaysEarned: 0 });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function fetchReferrals() {
      if (!user.id || activeSubTab !== 'indicacoes') return;
      
      setLoading(true);
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nome, email')
          .eq('referred_by', user.id);

        if (profilesError) throw profilesError;
        if (!profiles || profiles.length === 0) {
          setReferredUsers([]);
          setReferralStats({ totalActive: 0, totalDaysEarned: 0 });
          return;
        }

        const activeReferrals: { id: string; nome: string; email: string }[] = [];
        for (const profile of profiles) {
          const { count, error: countError } = await supabase
            .from('lancamentos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);
            
          if (!countError && count !== null && count > 10) {
            activeReferrals.push(profile);
          }
        }

        setReferredUsers(activeReferrals);
        setReferralStats({
          totalActive: activeReferrals.length,
          totalDaysEarned: activeReferrals.length * 30
        });
      } catch (err) {
        console.error('Error fetching referrals:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchReferrals();
  }, [user.id, activeSubTab]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="h-10 w-10 p-0 rounded-full hover:bg-white dark:hover:bg-gray-800"
        >
          <ChevronLeft className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        </Button>
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            Plano e Indicações
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie sua assinatura e convide amigos</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm font-bold text-center">{successMsg}</p>
        </div>
      )}

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden rounded-3xl">
        <CardContent className="p-4 sm:p-6">
          {/* Tabs Toggle */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8">
            <button
              onClick={() => setActiveSubTab('plano')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeSubTab === 'plano' 
                  ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Meu Plano
            </button>
            <button
              onClick={() => setActiveSubTab('indicacoes')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeSubTab === 'indicacoes' 
                  ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Indicações
            </button>
          </div>

          {activeSubTab === 'plano' ? (
            <div className="space-y-6">
              <div className={cn(
                "p-6 rounded-3xl border transition-all",
                user.premium_status === 'pending' 
                  ? "bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30" 
                  : isPremium(user) 
                    ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/50" 
                    : "bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-800"
              )}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm",
                    isPremium(user) ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className={cn(
                      "text-lg font-black",
                      user.premium_status === 'pending' ? 'text-amber-800 dark:text-amber-300' : (isPremium(user) ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-300')
                    )}>
                      {user.premium_status === 'pending' ? 'Assinatura em Análise' : (isPremium(user) ? 'Plano Premium Ativo' : 'Plano Gratuito')}
                    </h4>
                    {isPremium(user) && user.premium_until && (
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">
                        Expira em: {format(parseLocalDate(user.premium_until), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  {user.premium_status === 'pending' 
                    ? 'Seu pagamento está sendo analisado. Seu acesso será liberado assim que o pagamento for confirmado.'
                    : (isPremium(user) 
                      ? 'Você tem acesso ilimitado a todos os recursos do Atlas Financeiro, garantindo total controle sobre sua operação.'
                      : 'Faça o upgrade para o Premium e desbloqueie veículos ilimitados, exportação de relatórios, monitoramento de manutenção e muito mais.')}
                </p>
                
                <Button 
                  onClick={onNavigateToPremium} 
                  className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white h-14 rounded-2xl shadow-lg shadow-orange-500/20 font-black text-base transition-all active:scale-[0.98]"
                >
                  {!isPremium(user) && user.premium_status !== 'pending' ? 'ASSINAR PREMIUM' : (user.premium_status === 'pending' ? 'ACOMPANHAR PAGAMENTO' : 'ESTENDER MEU PLANO')}
                </Button>
              </div>

              {/* Benefits List */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Benefícios Premium</h5>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    "Veículos de trabalho ilimitados",
                    "Exportação de dados (PDF/Excel)",
                    "Acesso antecipado a novos recursos",
                    "Gráficos de desempenho detalhados",
                    "Dashboard de manutenção preventiva"
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                      <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-4">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] opacity-10">
                  <Gift className="h-40 w-40 rotate-12" />
                </div>
                <h4 className="text-xl font-black mb-2 uppercase tracking-tight">Dê 15, Ganhe 30! 🎁</h4>
                <p className="text-sm text-white/90 leading-relaxed font-medium">
                  Convide seus amigos para o melhor aliado financeiro dos motoristas. Quando eles se cadastrarem e fizerem os primeiros lançamentos, ambos ganham!
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2 px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Compartilhar meu link</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 flex items-center justify-between group overflow-hidden">
                      <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 truncate mr-2 font-bold uppercase">
                        {`${window.location.origin.replace(/^https?:\/\//, '')}/auth?ref=${user.referral_code || ''}`}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 w-10 p-0 shrink-0 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl"
                        onClick={() => {
                          const link = `${window.location.origin}/auth?ref=${user.referral_code || ''}`;
                          navigator.clipboard.writeText(link);
                          setSuccessMsg('Link de convite copiado!');
                          setTimeout(() => setSuccessMsg(''), 3000);
                        }}
                      >
                        <Copy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white flex items-center justify-center gap-3 h-14 rounded-2xl transition-all active:scale-[0.98] font-black shadow-lg shadow-emerald-500/20"
                  onClick={() => {
                    const link = `${window.location.origin}/auth?ref=${user.referral_code || ''}`;
                    const text = `Fala parceiro! Estou usando o Atlas para controlar meus ganhos e ele é fera! No link abaixo você já ganha 15 dias de Acesso Premium grátis: ${link}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-6 w-6" />
                  CONVIDAR NO WHATSAPP
                </Button>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between px-1">
                  <h5 className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 uppercase tracking-tight">
                     <Users className="h-4 w-4 text-amber-500" /> Indicados Ativos
                  </h5>
                  <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-full uppercase tracking-widest">
                    +{referralStats.totalDaysEarned} DIAS GANHOS
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sincronizando dados...</span>
                  </div>
                ) : referredUsers.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800 border-dashed">
                    <Users className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">Nenhuma indicação cadastrada</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 max-w-[200px] mx-auto leading-relaxed">Convide seus amigos e ajude a comunidade Atlas a crescer!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {referredUsers.map((refUser) => {
                      const displayName = refUser.nome 
                        ? refUser.nome.split(' ')[0] 
                        : (refUser.email || '').substring(0, 4);
                      
                      return (
                        <div key={refUser.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800/80">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 font-black text-sm shadow-inner uppercase">
                              {displayName.substring(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight truncate">
                                {displayName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                  Cadastro Confirmado
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-800-50">
                            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
