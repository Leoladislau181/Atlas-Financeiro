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
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 pb-24 sm:pb-0 transition-colors duration-200">
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white font-bold shadow-sm">
              A
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Atlas Financeiro
            </span>
          </div>

          <nav className="hidden sm:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                    activeTab === tab.id
                      ? 'bg-[#F59E0B]/10 text-[#D97706] dark:bg-[#F59E0B]/20 dark:text-[#FBBF24]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">{children}</main>

      {/* Floating Bottom Navigation for Mobile */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 sm:hidden">
        <div className="flex h-16 items-center justify-around rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-lg border border-gray-100 dark:border-gray-800 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200',
                  isActive ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                )}
              >
                {isActive && (
                  <span className="absolute -top-3 w-1 h-1 rounded-full bg-[#D97706] dark:bg-[#FBBF24]" />
                )}
                <Icon className={cn("transition-all duration-200", isActive ? "h-6 w-6" : "h-5 w-5")} />
                <span className={cn("text-[10px] font-medium transition-all duration-200", isActive ? "opacity-100" : "opacity-70")}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
