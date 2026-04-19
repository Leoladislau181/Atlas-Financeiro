import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatCurrencyInput, parseCurrency, parseLocalDate, isPremium, getMostUsedVehicleId } from '@/lib/utils';
import { Lancamento, Categoria, Vehicle, Manutencao, User, FuelType } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFuelAutoFill } from '@/hooks/useFuelAutoFill';

import { ArrowUpCircle, ArrowDownCircle, DollarSign, Wallet, Filter, Zap, Fuel, AlertTriangle, CheckCircle, Camera, Clock, Briefcase, StopCircle, ChevronRight, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { supabase } from '@/lib/supabase';
import { PremiumModal } from '@/components/premium-modal';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { useFeatures } from '@/contexts/FeatureContext';
import { InstallPWAButton } from '@/components/InstallPWAButton';

interface DashboardProps {
  lancamentos: Lancamento[];
  categorias: Categoria[];
  vehicles: Vehicle[];
  manutencoes: Manutencao[];
  refetch: () => void;
  user: User;
  onNavigate?: (tab: string) => void;
}

export function Dashboard({ lancamentos, categorias, vehicles, manutencoes, refetch, user, onNavigate }: DashboardProps) {
  const { preferences } = useFeatures();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const [monthsFilter, setMonthsFilter] = useState<number>(6);
  const [showFilter, setShowFilter] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [quickValueStr, setQuickValueStr] = useState('');
  const [quickKM, setQuickKM] = useState('');
  const [quickPricePerLiterStr, setQuickPricePerLiterStr] = useState('');
  const [quickFuelType, setQuickFuelType] = useState<FuelType | null>(null);
  const [quickVehicleId, setQuickVehicleId] = useState('');
  const [quickIsFullTank, setQuickIsFullTank] = useState(true);
  const [quickLoading, setQuickLoading] = useState(false);

  // Income Entry States
  const [incomeEntryOpen, setIncomeEntryOpen] = useState(false);
  const [incomeValueStr, setIncomeValueStr] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [incomeVehicleId, setIncomeVehicleId] = useState('');
  const [incomeLoading, setIncomeLoading] = useState(false);

  // Auto-fill states for Quick Refuel
  const [isQuickOdometerManuallyEdited, setIsQuickOdometerManuallyEdited] = useState(false);

  const [performModalOpen, setPerformModalOpen] = useState(false);
  const [performManutencao, setPerformManutencao] = useState<Manutencao | null>(null);
  const [performVehicle, setPerformVehicle] = useState<Vehicle | null>(null);
  const [performDate, setPerformDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [performKm, setPerformKm] = useState('');
  const [performValueStr, setPerformValueStr] = useState('');
  const [performObs, setPerformObs] = useState('');
  const [performLoading, setPerformLoading] = useState(false);

  const hasVehicles = vehicles.length > 0;
  const hasCategories = categorias.some(c => !c.is_system_default);
  const hasTransactions = lancamentos.length > 0;

  const daysUntilPremiumExpires = useMemo(() => {
    if (!user.premium_until || user.premium_status !== 'active') return null;
    const expiryDate = parseLocalDate(user.premium_until);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [user.premium_until, user.premium_status]);

  useEffect(() => {
    if (vehicles.length > 0 && quickEntryOpen) {
      const mostUsedId = getMostUsedVehicleId(vehicles, lancamentos);
      setQuickVehicleId(mostUsedId);
    }
  }, [vehicles, lancamentos, quickEntryOpen]);

  useEffect(() => {
    // Set default based on screen size on initial load
    if (window.innerWidth < 768) {
      setMonthsFilter(3);
    }
  }, []);

  const {
    suggestedPricePerLiter: quickSuggestedPricePerLiter,
    suggestedOdometer: quickSuggestedOdometer,
    setLastAutoFillTrigger: setLastQuickAutoFillTrigger
  } = useFuelAutoFill({
    vehicleId: quickVehicleId,
    fuelType: quickFuelType,
    lancamentos,
    vehicles,
    isActive: quickEntryOpen && quickVehicleId !== '',
    valorStr: quickValueStr,
    pricePerLiterStr: quickPricePerLiterStr,
    isOdometerManuallyEdited: isQuickOdometerManuallyEdited
  });

  useEffect(() => {
    if (quickSuggestedPricePerLiter !== null) {
      setQuickPricePerLiterStr(quickSuggestedPricePerLiter);
    }
  }, [quickSuggestedPricePerLiter]);

  useEffect(() => {
    if (quickSuggestedOdometer !== null) {
      setQuickKM(quickSuggestedOdometer);
    }
  }, [quickSuggestedOdometer]);

  const stats = useMemo(() => {
    let receitasMes = 0;
    let despesasMes = 0;
    let saldoGeral = 0;

    lancamentos.forEach((l) => {
      const valor = Number(l.valor);
      const data = parseLocalDate(l.data);
      const isCurrentMonth = isWithinInterval(data, { start, end });

      if (l.tipo === 'receita') {
        saldoGeral += valor;
        if (isCurrentMonth) receitasMes += valor;
      } else if (l.tipo === 'despesa') {
        saldoGeral -= valor;
        if (isCurrentMonth) despesasMes += valor;
      }
    });

    return {
      receitasMes,
      despesasMes,
      lucroLiquido: receitasMes - despesasMes,
      saldoGeral,
    };
  }, [lancamentos, start, end]);

  const handleQuickEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!quickValueStr || !quickKM) return;

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

    const valorNum = parseCurrency(quickValueStr);
    if (valorNum <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    const fuelCategory = categorias.find(c => c.nome.toLowerCase().includes('combustível') || c.nome.toLowerCase().includes('fuel'));
    const selectedVehicle = vehicles.find(v => v.id === quickVehicleId);

    if (!fuelCategory) {
      setErrorMsg('Categoria "Combustível" não encontrada. Por favor, crie uma categoria de despesa com esse nome primeiro nas configurações.');
      return;
    }

    if (!selectedVehicle) {
      setErrorMsg('Selecione um veículo.');
      return;
    }

    const pricePerLiter = parseCurrency(quickPricePerLiterStr);
    let fuelLiters = null;
    if (pricePerLiter > 0) {
      fuelLiters = valorNum / pricePerLiter;
    }

    setQuickLoading(true);
    try {
      const { error } = await supabase
        .from('lancamentos')
        .insert([{
          user_id: user.id,
          tipo: 'despesa',
          categoria_id: fuelCategory.id,
          vehicle_id: selectedVehicle.id,
          valor: valorNum,
          data: format(new Date(), 'yyyy-MM-dd'),
          odometer: Number(quickKM),
          fuel_price_per_liter: pricePerLiter > 0 ? pricePerLiter : null,
          fuel_liters: fuelLiters,
          fuel_type: quickFuelType,
          is_full_tank: quickIsFullTank,
          observacao: 'Abastecimento'
        }]);

      if (error) throw error;

      setQuickValueStr('');
      setQuickKM('');
      setQuickPricePerLiterStr('');
      setQuickFuelType(null);
      setQuickIsFullTank(true);
      setQuickEntryOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao registrar abastecimento.');
    } finally {
      setQuickLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const data = [];
    for (let i = monthsFilter - 1; i >= 0; i--) {
      const targetMonth = subMonths(now, i);
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);

      let receitas = 0;
      let despesas = 0;

      lancamentos.forEach((l) => {
        const valor = Number(l.valor);
        const dataLancamento = parseLocalDate(l.data);
        if (isWithinInterval(dataLancamento, { start: monthStart, end: monthEnd })) {
          if (l.tipo === 'receita') receitas += valor;
          else despesas += valor;
        }
      });

      data.push({
        name: format(targetMonth, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        Receitas: receitas,
        Despesas: despesas,
      });
    }
    return data;
  }, [lancamentos, monthsFilter, now]);

  const maintenanceAlerts = useMemo(() => {
    const alerts: { vehicle: Vehicle; manutencao: Manutencao; kmFaltante: number; status: 'warning' | 'danger'; currentOdometer: number }[] = [];
    
    manutencoes.forEach(m => {
      const vehicle = vehicles.find(v => v.id === m.vehicle_id);
      if (!vehicle) return;

      // Find current odometer for this vehicle
      const vLancamentos = lancamentos.filter(l => l.vehicle_id === vehicle.id && l.odometer);
      let currentOdometer = vehicle.initial_odometer;
      
      if (vLancamentos.length > 0) {
        currentOdometer = Math.max(...vLancamentos.map(l => l.odometer || 0), currentOdometer);
      }

      const kmProximaManutencao = m.ultimo_km_realizado + m.intervalo_km;
      const kmFaltante = kmProximaManutencao - currentOdometer;

      if (kmFaltante <= 0) {
        alerts.push({ vehicle, manutencao: m, kmFaltante, status: 'danger', currentOdometer });
      } else if (kmFaltante <= (m.aviso_km_antes || 1000)) {
        alerts.push({ vehicle, manutencao: m, kmFaltante, status: 'warning', currentOdometer });
      }
    });

    return alerts.sort((a, b) => a.kmFaltante - b.kmFaltante);
  }, [manutencoes, vehicles, lancamentos]);

  const handleOpenPerform = (alert: any) => {
    setPerformManutencao(alert.manutencao);
    setPerformVehicle(alert.vehicle);
    setPerformDate(format(new Date(), 'yyyy-MM-dd'));
    setPerformKm(alert.currentOdometer.toString());
    setPerformValueStr('');
    setPerformObs(`Manutenção: ${alert.manutencao.tipo}`);
    setPerformModalOpen(true);
  };

  const handleConfirmPerform = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!performManutencao || !performVehicle || !performKm || !performValueStr || !performDate) return;

    const valorNum = parseCurrency(performValueStr);
    if (valorNum <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    const maintCategory = categorias.find(c => c.nome.toLowerCase().includes('manuten'));
    if (!maintCategory) {
      setErrorMsg('Categoria "Manutenção" não encontrada. Por favor, crie uma categoria de despesa com esse nome primeiro nas configurações.');
      return;
    }

    setPerformLoading(true);
    try {
      // 1. Update Manutencao
      const { error: maintError } = await supabase
        .from('manutencoes')
        .update({ ultimo_km_realizado: Number(performKm) })
        .eq('id', performManutencao.id);
      if (maintError) throw maintError;

      // 2. Insert Lancamento
      const { error: lancError } = await supabase
        .from('lancamentos')
        .insert([{
          user_id: user.id,
          tipo: 'despesa',
          categoria_id: maintCategory.id,
          vehicle_id: performVehicle.id,
          valor: valorNum,
          data: performDate,
          odometer: Number(performKm),
          observacao: performObs
        }]);
      if (lancError) throw lancError;

      setPerformModalOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao registrar manutenção.');
    } finally {
      setPerformLoading(false);
    }
  };

  const handleIncomeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const valorNum = parseCurrency(incomeValueStr);
    if (valorNum <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return;
    }

    if (!incomeCategoryId) {
      setErrorMsg('Selecione uma categoria.');
      return;
    }

    setIncomeLoading(true);
    try {
      const { error } = await supabase
        .from('lancamentos')
        .insert([{
          user_id: user.id,
          tipo: 'receita',
          categoria_id: incomeCategoryId,
          valor: valorNum,
          data: format(new Date(), 'yyyy-MM-dd'),
          vehicle_id: incomeVehicleId || null,
          observacao: 'Lançamento de ganhos'
        }]);

      if (error) throw error;

      setIncomeEntryOpen(false);
      setIncomeValueStr('');
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar ganhos.');
    } finally {
      setIncomeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {daysUntilPremiumExpires !== null && daysUntilPremiumExpires <= 3 && daysUntilPremiumExpires >= 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-300">
                Sua assinatura Premium vence {daysUntilPremiumExpires === 0 ? 'hoje' : `em ${daysUntilPremiumExpires} dia${daysUntilPremiumExpires > 1 ? 's' : ''}`}!
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-0.5">
                Renove agora para não perder o acesso aos recursos exclusivos.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => onNavigate && onNavigate('premium')}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            Renovar Agora
          </Button>
        </div>
      )}

      <InstallPWAButton />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resumo</h2>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              setQuickEntryOpen(true);
              setIsQuickOdometerManuallyEdited(false);
              setLastQuickAutoFillTrigger('');
            }}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-white shadow-sm gap-2"
          >
            <Fuel className="h-4 w-4" />
            <span className="hidden sm:inline">Abastecer</span>
            <span className="sm:hidden">Abastecer</span>
          </Button>
        </div>
      </div>

      {!hasVehicles ? (
        <OnboardingGuide
          step="vehicle"
          title="Cadastre seu primeiro veículo"
          description="Para começar a controlar seus gastos, adicione o carro ou moto que você utiliza."
          onClick={() => onNavigate && onNavigate('veiculos')}
          buttonText="Adicionar Veículo"
        />
      ) : !hasCategories ? (
        <OnboardingGuide
          step="category"
          title="Crie suas categorias"
          description="Organize suas finanças! Crie categorias personalizadas como 'Alimentação' ou 'Impostos'."
          onClick={() => onNavigate && onNavigate('configuracoes')}
          buttonText="Criar Categoria"
        />
      ) : !hasTransactions ? (
        <OnboardingGuide
          step="transaction"
          title="Registre seu primeiro lançamento"
          description="Tudo pronto! Agora é só registrar seu primeiro gasto ou ganho para ver os gráficos."
          onClick={() => onNavigate && onNavigate('lancamentos')}
          buttonText="Novo Lançamento"
        />
      ) : null}

      {maintenanceAlerts.length > 0 && preferences.alerta_manutencao && isPremium(user) && (
        <div className="grid grid-cols-1 gap-3">
          {maintenanceAlerts.map((alert, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                alert.status === 'danger' 
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' 
                  : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-6 w-6 shrink-0 ${alert.status === 'danger' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400'}`} />
                <div>
                  <h4 className={`font-bold ${alert.status === 'danger' ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                    {alert.status === 'danger' ? 'Manutenção Atrasada!' : 'Atenção: Manutenção Próxima'}
                  </h4>
                  <p className={`text-sm ${alert.status === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                    {alert.manutencao.tipo} do veículo <strong>{alert.vehicle.name}</strong>. 
                    {alert.status === 'danger' 
                      ? ` Passou ${Math.abs(alert.kmFaltante).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km do limite.` 
                      : ` Faltam apenas ${alert.kmFaltante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km.`}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => handleOpenPerform(alert)}
                className={`shrink-0 self-start sm:self-auto ${alert.status === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Realizar
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        <Card 
          onClick={() => onNavigate && onNavigate('lancamentos')}
          className="col-span-2 lg:col-span-1 border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 relative cursor-pointer active:scale-[0.98] group overflow-hidden"
        >
          <div className="flex items-center justify-center sm:block p-4 sm:p-0">
            {/* Mobile-only larger arrow */}
            <div className="sm:hidden pr-4">
              <ChevronRight className="h-10 w-10 text-[#F59E0B]" />
            </div>

            <div className="flex-1 text-left sm:text-center">
              <CardHeader className="flex flex-row items-center justify-start sm:justify-center gap-2 space-y-0 p-0 sm:pt-4 sm:pb-2">
                <DollarSign className={`h-5 w-5 sm:h-6 sm:w-6 ${stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`} />
                <CardTitle className="text-xs sm:text-lg font-medium text-gray-500 dark:text-gray-400">Saldo Total</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:px-2 sm:pb-4">
                <div
                  className={`text-xl sm:text-4xl font-bold break-words ${
                    stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'
                  }`}
                >
                  {formatCurrency(stats.lucroLiquido)}
                </div>
              </CardContent>
            </div>
          </div>

          {/* Bottom Right Corner: Extrato + Arrow (Desktop) / Extrato only (Mobile) */}
          <div className="absolute bottom-2 right-3 flex items-center gap-1 group-hover:scale-110 transition-transform origin-right">
            <span className="text-[10px] text-[#F59E0B] font-bold uppercase underline decoration-2 underline-offset-4">Extrato</span>
            <ChevronRight className="hidden sm:block h-4 w-4 text-[#F59E0B]" />
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-3 sm:py-4">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-1 sm:pb-2">
            <ArrowUpCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[#059568] dark:text-[#10B981]" />
            <CardTitle className="text-xs sm:text-lg font-medium text-gray-500 dark:text-gray-400">Ganhos</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-2">
            <div className="text-base sm:text-3xl font-bold text-[#059568] dark:text-[#10B981] break-words px-1">
              {formatCurrency(stats.receitasMes)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-3 sm:py-4">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-1 sm:pb-2">
            <ArrowDownCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[#EF4444] dark:text-[#F87171]" />
            <CardTitle className="text-xs sm:text-lg font-medium text-gray-500 dark:text-gray-400">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-2">
            <div className="text-base sm:text-3xl font-bold text-[#EF4444] dark:text-[#F87171] break-words px-1">
              {formatCurrency(stats.despesasMes)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-3 border-none shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comparativo Mensal</CardTitle>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowFilter(!showFilter)} 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Filter className="h-4 w-4" />
            </Button>
            {showFilter && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="py-1">
                  {[3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => {
                        setMonthsFilter(months);
                        setShowFilter(false);
                      }}
                      className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        monthsFilter === months 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      Últimos {months} meses
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pl-0 pr-2">
          <div className="h-[280px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-gray-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 10 }} className="text-gray-500 dark:text-gray-400" dy={10} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `v.${(value/1000).toFixed(0)}k`}
                  tick={{ fill: 'currentColor', fontSize: 10 }}
                  className="text-gray-500 dark:text-gray-400"
                  dx={0}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: 'currentColor', opacity: 0.1 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', backgroundColor: 'var(--tw-colors-white)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Receitas" fill="#059568" radius={[6, 6, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={quickEntryOpen}
        onClose={() => {
          setQuickEntryOpen(false);
          setErrorMsg('');
        }}
        title="Registrar Abastecimento"
        className="max-w-lg"
      >
        <form onSubmit={handleQuickEntry} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
          {vehicles.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo</label>
              <CustomSelect 
                value={quickVehicleId} 
                onChange={setQuickVehicleId}
                options={[
                  { value: '', label: 'Selecione um veículo' },
                  ...vehicles
                    .filter(v => v.status === 'active')
                    .map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Pago (R$)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={quickValueStr}
                onChange={(e) => setQuickValueStr(formatCurrencyInput(e.target.value))}
                placeholder="R$ 0,00"
                required
                autoFocus
              />
            </div>

            {preferences.modulo_abastecimento_detalhado && isPremium(user) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Combustível</label>
                <CustomSelect
                  value={quickFuelType || ''}
                  onChange={(val) => setQuickFuelType(val as FuelType)}
                  options={[
                    { value: 'gasolina', label: 'Gasolina' },
                    { value: 'etanol', label: 'Etanol' },
                    { value: 'diesel', label: 'Diesel' },
                    { value: 'gnv', label: 'GNV' },
                  ]}
                  placeholder="Selecione"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {preferences.modulo_abastecimento_detalhado && isPremium(user) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preço por Litro</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={quickPricePerLiterStr}
                  onChange={(e) => setQuickPricePerLiterStr(formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KM Atual</label>
              <Input
                type="number"
                inputMode="numeric"
                value={quickKM}
                onChange={(e) => {
                  setQuickKM(e.target.value);
                  setIsQuickOdometerManuallyEdited(true);
                }}
                placeholder="0"
                required
              />
            </div>
          </div>

          {preferences.modulo_abastecimento_detalhado && isPremium(user) && (
            <div className="space-y-2 flex items-center pt-2">
              <input
                type="checkbox"
                id="quickIsFullTank"
                checked={quickIsFullTank}
                onChange={(e) => setQuickIsFullTank(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
              />
              <label htmlFor="quickIsFullTank" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Tanque Cheio? (Usado para calcular a média de consumo)
              </label>
            </div>
          )}

          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={quickLoading}
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white"
            >
              {quickLoading ? 'Salvando...' : 'Confirmar Abastecimento'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={performModalOpen}
        onClose={() => {
          setPerformModalOpen(false);
          setErrorMsg('');
        }}
        title="Realizar Manutenção"
        className="max-w-md"
      >
        <form onSubmit={handleConfirmPerform} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo e Serviço</label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
              {performVehicle?.name} - {performManutencao?.tipo}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data da Manutenção *</label>
            <Input
              type="date"
              value={performDate}
              onChange={(e) => setPerformDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KM Atual *</label>
            <Input
              type="number"
              inputMode="numeric"
              value={performKm}
              onChange={(e) => setPerformKm(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Gasto (R$) *</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={performValueStr}
              onChange={(e) => setPerformValueStr(formatCurrencyInput(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observação</label>
            <Input
              type="text"
              placeholder="Ex: Troca de óleo Motul e filtro"
              value={performObs}
              onChange={(e) => setPerformObs(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setPerformModalOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={performLoading} className="w-full sm:w-auto bg-[#059568] hover:bg-[#047857] text-white">
              {performLoading ? 'Salvando...' : 'Confirmar e Lançar'}
            </Button>
          </div>
        </form>
      </Modal>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        featureName={premiumFeatureName}
        user={user}
      />
    </div>
  );
}
