import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { Auth } from '@/pages/auth';
import { Layout } from '@/components/layout';
import { Dashboard } from '@/pages/dashboard';
import { Lancamentos } from '@/pages/lancamentos';
import { Relatorios } from '@/pages/relatorios';
import { Configuracoes } from '@/pages/configuracoes';
import { useFinanceData } from '@/hooks/useFinanceData';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '' });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '' });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session || !user) {
    return <Auth />;
  }

  return <MainApp user={user} activeTab={activeTab} setActiveTab={setActiveTab} />;
}

function MainApp({ user, activeTab, setActiveTab }: { user: User; activeTab: string; setActiveTab: (tab: string) => void }) {
  const { categorias, lancamentos, loading, refetch } = useFinanceData();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <div className="text-lg font-medium text-gray-500">Carregando dados...</div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'inicio' && <Dashboard lancamentos={lancamentos} />}
      {activeTab === 'lancamentos' && (
        <Lancamentos
          categorias={categorias}
          lancamentos={lancamentos}
          refetch={refetch}
          userId={user.id}
        />
      )}
      {activeTab === 'relatorios' && <Relatorios lancamentos={lancamentos} />}
      {activeTab === 'configuracoes' && (
        <Configuracoes categorias={categorias} user={user} refetch={refetch} />
      )}
    </Layout>
  );
}

