import React from 'react';
import { LogOut, Home, List, BarChart2, Car, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const tabs = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'lancamentos', label: 'Lançamentos', icon: List },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
    { id: 'veiculos', label: 'Veículos', icon: Car },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-gray-900 pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 w-full border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-white font-bold">
              A
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
              Atlas Financeiro
            </span>
          </div>

          <nav className="hidden sm:flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 z-50 w-full border-t bg-white sm:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-2 py-1 transition-colors',
                  activeTab === tab.id ? 'text-[#F59E0B]' : 'text-gray-500'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
