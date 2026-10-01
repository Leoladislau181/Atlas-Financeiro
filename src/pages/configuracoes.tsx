import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { Categoria, TipoLancamento, User, WorkShift, Vehicle, Lancamento } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, User as UserIcon, Settings, Shield, Tag, ChevronDown, ChevronUp, Moon, Sun, Camera, BarChart2, Gift, Copy, Car, Download, Users, Star, Database, RefreshCw, MessageCircle, Briefcase, Filter, Calendar, Clock, Lock, Calculator, DollarSign, Layout, Fuel, Layers, Bell, Upload, CheckCircle, Wrench, HelpCircle, LogOut } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useFeatures } from '@/contexts/FeatureContext';
import { Switch } from '@/components/ui/switch';
import { ProfilePhotoUpload } from '@/components/profile-photo-upload';
import { isPremium, parseLocalDate, formatCurrency, formatCurrencyInput, parseCurrency, cn, getMostUsedVehicleId } from '@/lib/utils';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { PremiumModal } from '@/components/premium-modal';
import { format, isWithinInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PremiumLockedOverlay } from '@/components/PremiumLockedOverlay';

interface ConfiguracoesProps {
  categorias: Categoria[];
  workShifts: WorkShift[];
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  user: User;
  refetch: () => void;
  onNavigateToRelatorios?: () => void;
  onNavigateToPremium?: () => void;
  onNavigateToVeiculos?: () => void;
  onNavigateToManutencao?: () => void;
  onNavigateToFuncionalidades?: () => void;
  onNavigateToCategorias?: () => void;
  onNavigateToSuporte?: () => void;
  onNavigateToPlanoIndicacoes?: () => void;
  onNavigateToPerfil?: () => void;
  onNavigateToCalculadora?: () => void;
  onNavigateToTurnos?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToNewVehicle?: () => void;
  onNavigateToNewCategory?: () => void;
  forceOpenProfile?: boolean;
  onProfileOpened?: () => void;
}

export function Configuracoes({ 
  categorias, 
  workShifts,
  vehicles,
  lancamentos,
  user, 
  refetch, 
  onNavigateToRelatorios, 
  onNavigateToPremium, 
  onNavigateToVeiculos, 
  onNavigateToManutencao,
  onNavigateToFuncionalidades,
  onNavigateToCategorias,
  onNavigateToSuporte,
  onNavigateToPlanoIndicacoes,
  onNavigateToPerfil,
  onNavigateToCalculadora,
  onNavigateToTurnos,
  onNavigateToAdmin,
  onNavigateToNewVehicle,
  onNavigateToNewCategory,
  forceOpenProfile, 
  onProfileOpened 
}: ConfiguracoesProps) {
  const [loading, setLoading] = useState(false);

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const mostUsedVehicleId = useMemo(() => getMostUsedVehicleId(vehicles, lancamentos), [vehicles, lancamentos]);

  const { preferences, toggleFeature } = useFeatures();

  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {(errorMsg || successMsg) && (
        <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-200 ${
          errorMsg 
            ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{errorMsg || successMsg}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="h-8 w-8 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {user.role === 'admin' && (
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden ring-2 ring-red-500/20">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 border-red-500"
              onClick={onNavigateToAdmin}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Shield className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">Painel Admin</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gerenciamento completo da plataforma</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
                <ChevronDown className="h-5 w-5 -rotate-90" />
              </Button>
            </div>
          </Card>
        )}

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 border-blue-500"
            onClick={onNavigateToPerfil}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <UserIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Perfil</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Preferências e informações particulares</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 border-amber-500"
            onClick={onNavigateToCategorias}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Tag className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Categorias</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie suas categorias de receitas e despesas</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 border-amber-500"
            onClick={onNavigateToPlanoIndicacoes}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Meu Plano e Indicações</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.premium_status === 'pending' ? 'Assinatura em Análise ⏳' : (isPremium(user) ? 'Plano Premium 🌟' : 'Plano Gratuito')} • Indicações
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={onNavigateToVeiculos}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Car className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Veículos e Manutenção</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie sua frota e agendamentos de revisão</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={onNavigateToFuncionalidades}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Recursos e Funcionalidades</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Personalize sua experiência e conheça os recursos</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={onNavigateToRelatorios}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <BarChart2 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Relatórios Detalhados</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Consulte gráficos e exporte seus dados</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={onNavigateToSuporte}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <MessageCircle className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Central de Suporte</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fale com nossa equipe, tire dúvidas e relate problemas</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={onNavigateToCalculadora}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Calculadora de Ganhos e Metas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Planeje sua semana e descubra seu valor mínimo por KM</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>



        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 border-indigo-500"
            onClick={onNavigateToTurnos}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Configurações de Turnos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie seus turnos de trabalho</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </Button>
          </div>
        </Card>

        {/* Botão de Sair Grande e Vermelho  */}
        <div className="pt-4">
          <Button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full h-14 text-base font-bold bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Sair do Aplicativo
          </Button>
        </div>
      </div>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        featureName={premiumFeatureName}
        user={user}
      />

      {/* Modal de Confirmação de Logout */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Sair do Aplicativo"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <LogOut className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              Tem certeza que deseja sair?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Você precisará fazer login novamente para acessar seus dados e lançamentos.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLogoutModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleLogout}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, quero sair
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
