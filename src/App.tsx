import React, { useState, useEffect, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { User } from '@/types';
import { isPremium, parseLocalDate } from '@/lib/utils';
import { Auth } from '@/pages/auth';
import { Layout } from '@/components/layout';
import { useFinanceData } from '@/hooks/useFinanceData';
import { ThemeProvider } from '@/components/theme-provider';

const Dashboard = React.lazy(() => import('@/pages/dashboard').then(m => ({ default: m.Dashboard })));
const Lancamentos = React.lazy(() => import('@/pages/lancamentos').then(m => ({ default: m.Lancamentos })));
const Relatorios = React.lazy(() => import('@/pages/relatorios').then(m => ({ default: m.Relatorios })));
const Configuracoes = React.lazy(() => import('@/pages/configuracoes').then(m => ({ default: m.Configuracoes })));
const Veiculos = React.lazy(() => import('@/pages/veiculos').then(m => ({ default: m.Veiculos })));
const Premium = React.lazy(() => import('@/pages/premium').then(m => ({ default: m.Premium })));
const Admin = React.lazy(() => import('@/pages/admin').then(m => ({ default: m.Admin })));
const Suporte = React.lazy(() => import('@/pages/suporte').then(m => ({ default: m.Suporte })));
import { PremiumModal } from '@/components/premium-modal';

function SupabaseSetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl mb-8 overflow-hidden">
          <img 
            src="/logo.svg" 
            alt="Atlas Logo" 
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Configuração Necessária
        </h2>
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl space-y-6 text-left border border-gray-100 dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-400">
            Para o <strong>Atlas Financeiro</strong> funcionar, você precisa conectar seu projeto Supabase:
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-white text-xs font-bold">1</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Crie um projeto no <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-[#F59E0B] hover:underline font-semibold">Supabase</a>.
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-white text-xs font-bold">2</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Vá em <strong>Project Settings</strong> → <strong>API</strong> e copie o <strong>Project URL</strong> e a <strong>anon public key</strong>.
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-white text-xs font-bold">3</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                No AI Studio, abra <strong>Settings</strong> (⚙️) → <strong>Secrets</strong> e adicione:
                <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">VITE_SUPABASE_URL</code>
                <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">VITE_SUPABASE_ANON_KEY</code>
              </p>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-500 italic">
            O aplicativo será reiniciado automaticamente após você salvar as chaves.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Se houver erro na sessão (ex: token expirado/inválido), o Supabase
          // já lida com a invalidação interna. Apenas garantimos o estado limpo.
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
          return;
        }

        setSession(session);
        if (session?.user) {
          // Fetch profile data to get secure fields like role and premium_until
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, premium_until')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.warn("Perfil não encontrado ou erro ao buscar. O trigger do Supabase deve criar automaticamente para novos usuários.", profileError.message);
          }

          setUser({ 
            id: session.user.id, 
            email: session.user.email || '',
            nome: session.user.user_metadata?.nome || '',
            telefone: session.user.user_metadata?.telefone || '',
            foto_url: session.user.user_metadata?.foto_url || '',
            referral_code: session.user.user_metadata?.referral_code || '',
            referred_by: session.user.user_metadata?.referred_by || '',
            premium_status: session.user.user_metadata?.premium_status || 'none',
            premium_plan: session.user.user_metadata?.premium_plan || '',
            payment_receipt_url: session.user.user_metadata?.payment_receipt_url || '',
            was_premium_before_renewal: session.user.user_metadata?.was_premium_before_renewal || false,
            premium_until: profile?.premium_until || '',
            role: profile?.role || 'user'
          });
        }
      } catch (err) {
        setSession(null);
        setUser(null);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (session?.user) {
        // Fetch profile data to get secure fields like role and premium_until
        supabase
          .from('profiles')
          .select('role, premium_until')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error: profileError }) => {
            if (profileError) {
              console.warn("Perfil não encontrado no onAuthStateChange:", profileError.message);
            }
            
            setUser({ 
              id: session.user.id, 
              email: session.user.email || '',
              nome: session.user.user_metadata?.nome || '',
              telefone: session.user.user_metadata?.telefone || '',
              foto_url: session.user.user_metadata?.foto_url || '',
              referral_code: session.user.user_metadata?.referral_code || '',
              referred_by: session.user.user_metadata?.referred_by || '',
              premium_status: session.user.user_metadata?.premium_status || 'none',
              premium_plan: session.user.user_metadata?.premium_plan || '',
              payment_receipt_url: session.user.user_metadata?.payment_receipt_url || '',
              was_premium_before_renewal: session.user.user_metadata?.was_premium_before_renewal || false,
              premium_until: profile?.premium_until || '',
              role: profile?.role || 'user'
            });
          });
      } else {
        setUser(null);
      }

      // Se a sessão for invalidada ou o usuário sair, garante que o estado local seja limpo
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Update favicon if user has a profile photo
    if (user?.foto_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = user.foto_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [user?.foto_url]);

  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }

  if (!session || !user) {
    return <Auth />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="atlas-theme">
      <MainApp user={user} activeTab={activeTab} setActiveTab={setActiveTab} />
    </ThemeProvider>
  );
}

function MainApp({ user, activeTab, setActiveTab }: { user: User; activeTab: string; setActiveTab: (tab: string) => void }) {
  const { categorias, lancamentos, vehicles, manutencoes, loading, refetch } = useFinanceData();
  const [isNewLancamentoOpen, setIsNewLancamentoOpen] = useState(false);
  const [forceOpenProfile, setForceOpenProfile] = useState(false);
  const [forceOpenReceiptReader, setForceOpenReceiptReader] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F9FAFB] dark:bg-gray-950">
        <div className="h-16 w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 animate-pulse"></div>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-pulse"></div>
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const handleNewLancamento = () => {
    if (!isPremium(user)) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const transactionsThisMonth = lancamentos.filter(l => {
        const d = parseLocalDate(l.data);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      if (transactionsThisMonth.length >= 50) {
        setPremiumFeatureName('Lançamentos Ilimitados');
        setIsPremiumModalOpen(true);
        return;
      }
    }
    setActiveTab('lancamentos');
    setIsNewLancamentoOpen(true);
  };

  const handleProfileClick = () => {
    setActiveTab('configuracoes');
    setForceOpenProfile(true);
  };

  const handleOpenReceiptReader = () => {
    setActiveTab('lancamentos');
    setForceOpenReceiptReader(true);
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onNewLancamento={handleNewLancamento}
      onProfileClick={handleProfileClick}
      user={user}
    >
      <Suspense fallback={
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F59E0B] dark:border-gray-800 dark:border-t-[#F59E0B]"></div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Carregando interface...</p>
          </div>
        </div>
      }>
        {activeTab === 'inicio' && (
          <Dashboard 
            lancamentos={lancamentos} 
            categorias={categorias} 
            vehicles={vehicles} 
            manutencoes={manutencoes}
            refetch={refetch}
            user={user}
            onReadReceipt={handleOpenReceiptReader}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'lancamentos' && (
          <Lancamentos
            categorias={categorias}
            lancamentos={lancamentos}
            vehicles={vehicles}
            refetch={refetch}
            user={user}
            forceOpenForm={isNewLancamentoOpen}
            onFormClose={() => setIsNewLancamentoOpen(false)}
            forceOpenReceiptReader={forceOpenReceiptReader}
            onReceiptReaderClose={() => setForceOpenReceiptReader(false)}
          />
        )}
        {activeTab === 'relatorios' && (
          <Relatorios 
            lancamentos={lancamentos} 
            vehicles={vehicles} 
            categorias={categorias}
            user={user} 
            refetch={refetch}
          />
        )}
        {activeTab === 'veiculos' && (
          <Veiculos
            vehicles={vehicles}
            lancamentos={lancamentos}
            manutencoes={manutencoes}
            refetch={refetch}
            user={user}
          />
        )}
        {activeTab === 'premium' && (
          <Premium user={user} refetch={refetch} />
        )}
        {activeTab === 'admin' && (
          <Admin user={user} />
        )}
        {activeTab === 'suporte' && (
          <Suporte user={user} onBack={() => setActiveTab('configuracoes')} />
        )}
        {activeTab === 'configuracoes' && (
          <Configuracoes 
            categorias={categorias} 
            user={user} 
            refetch={refetch} 
            onNavigateToRelatorios={() => setActiveTab('relatorios')}
            onNavigateToPremium={() => setActiveTab('premium')}
            onNavigateToVeiculos={() => setActiveTab('veiculos')}
            onNavigateToSuporte={() => setActiveTab('suporte')}
            forceOpenProfile={forceOpenProfile}
            onProfileOpened={() => setForceOpenProfile(false)}
          />
        )}
      </Suspense>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        featureName={premiumFeatureName}
        user={user}
      />
    </Layout>
  );
}

