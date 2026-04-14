import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { Categoria, TipoLancamento, User, WorkShift, Vehicle, Lancamento } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, User as UserIcon, Settings, Shield, Tag, ChevronDown, ChevronUp, Moon, Sun, Camera, BarChart2, Gift, Copy, Car, Download, Users, Star, Database, RefreshCw, MessageCircle, Briefcase, Filter, Calendar, Clock, Lock, Calculator, DollarSign } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { ProfilePhotoUpload } from '@/components/profile-photo-upload';
import { isPremium, parseLocalDate, formatCurrency, formatCurrencyInput, parseCurrency } from '@/lib/utils';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { PremiumModal } from '@/components/premium-modal';
import { format, isWithinInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';

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
  onNavigateToSuporte?: () => void;
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
  onNavigateToSuporte,
  forceOpenProfile, 
  onProfileOpened 
}: ConfiguracoesProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileNome, setProfileNome] = useState(user.nome || '');
  const [profileTelefone, setProfileTelefone] = useState(user.telefone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isSupportSectionOpen, setIsSupportSectionOpen] = useState(false);
  const [isCategoriesSectionOpen, setIsCategoriesSectionOpen] = useState(false);
  const [isFeaturesSectionOpen, setIsFeaturesSectionOpen] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Shift Management States
  const [isShiftsOpen, setIsShiftsOpen] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  
  // Calculator States
  const [calcMode, setCalcMode] = useState<'weekly' | 'monthly'>('weekly');
  const [calcVehicleId, setCalcVehicleId] = useState('');
  const [calcDaysPerWeek, setCalcDaysPerWeek] = useState('5');
  const [calcKmPerDay, setCalcKmPerDay] = useState('150');
  const [calcProfitGoal, setCalcProfitGoal] = useState(formatCurrency(1000));
  const [calcFuelPrice, setCalcFuelPrice] = useState(formatCurrency(5.50));
  const [calcConsumption, setCalcConsumption] = useState('10');
  const [calcOtherFixed, setCalcOtherFixed] = useState(formatCurrency(0));
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState('');
  const [shiftOdometer, setShiftOdometer] = useState('');
  const [shiftVehicleId, setShiftVehicleId] = useState('');
  const [shiftType, setShiftType] = useState<'work' | 'personal'>('work');
  const [shiftLoading, setShiftLoading] = useState(false);
  const [deleteShiftModalOpen, setDeleteShiftModalOpen] = useState(false);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

  // Shift Filters
  const [showShiftFilters, setShowShiftFilters] = useState(false);
  const [shiftFilterTime, setShiftFilterTime] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [shiftFilterVehicle, setShiftFilterVehicle] = useState<string>('all');
  const [shiftFilterStartDate, setShiftFilterStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [shiftFilterEndDate, setShiftFilterEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const hasCategories = categorias.some(c => !c.is_system_default);

  const featuresList = [
    {
      id: 'financeiro',
      title: 'Gestão Financeira',
      icon: <Tag className="h-5 w-5 text-emerald-500" />,
      description: 'Controle completo de receitas e despesas com categorias personalizadas e filtros por período. Visualize seu saldo líquido e acompanhe o fluxo de caixa em tempo real.'
    },
    {
      id: 'veiculos',
      title: 'Controle de Veículos',
      icon: <Car className="h-5 w-5 text-blue-500" />,
      description: 'Gerencie sua frota, acompanhe o desempenho individual de cada veículo e defina metas de lucro. Tenha o controle total de gastos por carro ou moto.'
    },
    {
      id: 'turnos',
      title: 'Gestão de Turnos',
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      description: 'Registre sua jornada de trabalho, controle o odômetro e saiba exatamente quanto ganha por hora. Ideal para motoristas de aplicativo que buscam eficiência.'
    },
    {
      id: 'manutencao',
      title: 'Manutenção e Alertas',
      icon: <Settings className="h-5 w-5 text-rose-500" />,
      description: 'Receba avisos automáticos para troca de óleo e revisões baseados na quilometragem rodada. Evite quebras inesperadas e mantenha seu veículo sempre em dia.'
    },
    {
      id: 'relatorios',
      title: 'Dashboards e Relatórios',
      icon: <BarChart2 className="h-5 w-5 text-purple-500" />,
      description: 'Visualize sua evolução em gráficos interativos e exporte relatórios profissionais em PDF ou Excel para contabilidade ou análise pessoal.'
    },
    {
      id: 'premium',
      title: 'Plano Premium',
      icon: <Star className="h-5 w-5 text-amber-500" />,
      description: 'Desbloqueie lançamentos ilimitados, suporte prioritário e ferramentas avançadas de análise financeira para maximizar seus lucros.'
    }
  ];

  const filteredShifts = React.useMemo(() => {
    return workShifts.filter(shift => {
      // Vehicle Filter
      if (shiftFilterVehicle !== 'all' && shift.vehicle_id !== shiftFilterVehicle) {
        return false;
      }

      // Time Filter
      const shiftDate = parseLocalDate(shift.date);
      const now = new Date();

      if (shiftFilterTime === 'today') {
        if (shift.date !== format(now, 'yyyy-MM-dd')) return false;
      } else if (shiftFilterTime === 'week') {
        const start = startOfWeek(now, { weekStartsOn: 0 });
        const end = endOfWeek(now, { weekStartsOn: 0 });
        if (!isWithinInterval(shiftDate, { start, end })) return false;
      } else if (shiftFilterTime === 'month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        if (!isWithinInterval(shiftDate, { start, end })) return false;
      } else if (shiftFilterTime === 'year') {
        const start = startOfYear(now);
        const end = endOfYear(now);
        if (!isWithinInterval(shiftDate, { start, end })) return false;
      } else if (shiftFilterTime === 'custom') {
        const start = parseLocalDate(shiftFilterStartDate);
        const end = parseLocalDate(shiftFilterEndDate);
        if (!isWithinInterval(shiftDate, { start, end })) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date + 'T' + b.start_time).getTime() - new Date(a.date + 'T' + a.start_time).getTime());
  }, [workShifts, shiftFilterTime, shiftFilterVehicle, shiftFilterStartDate, shiftFilterEndDate]);

  const calculatorResults = React.useMemo(() => {
    if (!calcVehicleId) return null;
    
    const vehicle = vehicles.find(v => v.id === calcVehicleId);
    if (!vehicle) return null;

    const days = Number(calcDaysPerWeek.replace(',', '.')) || 0;
    const kmPerDay = Number(calcKmPerDay.replace(',', '.')) || 0;
    const profitGoal = parseCurrency(calcProfitGoal) || 0;
    const fuelPrice = parseCurrency(calcFuelPrice) || 0;
    const consumption = Number(calcConsumption.replace(',', '.')) || 1;
    const otherFixed = parseCurrency(calcOtherFixed) || 0;

    const isMonthly = calcMode === 'monthly';
    const totalKm = days * kmPerDay;
    
    // Variable Costs
    const fuelCost = consumption > 0 ? (totalKm / consumption) * fuelPrice : 0;
    
    // Rented vehicles don't have maintenance reserve
    const isRented = vehicle.type === 'rented';
    const maintenanceCostPerKm = isRented ? 0 : (vehicle.maintenance_reserve || 0.15);
    const maintenanceCost = totalKm * maintenanceCostPerKm;
    
    // Fixed Costs
    const monthlyFixed = (isRented ? (vehicle.contract_value || 0) : 0) + otherFixed;
    const fixedCost = isMonthly ? monthlyFixed : (monthlyFixed / 30) * 7;

    const totalCosts = fuelCost + maintenanceCost + fixedCost;
    const totalRevenueNeeded = totalCosts + profitGoal;
    
    const minPricePerKm = totalKm > 0 ? totalRevenueNeeded / totalKm : 0;
    const dailyGrossTarget = days > 0 ? totalRevenueNeeded / days : 0;

    return {
      totalKm,
      fuelCost,
      maintenanceCost,
      fixedCost,
      totalCosts,
      totalRevenueNeeded,
      minPricePerKm,
      dailyGrossTarget,
      isRented,
      mode: calcMode
    };
  }, [calcVehicleId, calcDaysPerWeek, calcKmPerDay, calcProfitGoal, calcFuelPrice, calcConsumption, calcOtherFixed, vehicles, calcMode]);

  // Auto-pull vehicle analysis when vehicle changes
  React.useEffect(() => {
    if (!calcVehicleId) return;

    const vehicle = vehicles.find(v => v.id === calcVehicleId);
    if (!vehicle) return;

    // Find fuel entries for this vehicle
    const vLancamentos = lancamentos.filter(l => l.vehicle_id === calcVehicleId);
    const sortedFuelEntries = vLancamentos
      .filter(l => l.tipo === 'despesa' && l.fuel_liters && l.fuel_liters > 0 && l.odometer)
      .sort((a, b) => a.odometer! - b.odometer!);

    const fuelEntries = [...sortedFuelEntries]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    if (fuelEntries.length > 0) {
      // Last fuel price
      const lastPrice = fuelEntries[0].fuel_price_per_liter;
      if (lastPrice) setCalcFuelPrice(formatCurrency(lastPrice));

      // Average consumption calculation (matching Veiculos logic)
      let mediaKmL = '0.0';
      const fullTanks = sortedFuelEntries.filter(l => l.is_full_tank);
      
      if (fullTanks.length >= 2) {
        const recentFullTanks = fullTanks.slice(-4);
        const startFullTank = recentFullTanks[0];
        const endFullTank = recentFullTanks[recentFullTanks.length - 1];
        const distance = endFullTank.odometer! - startFullTank.odometer!;
        const entriesInCycle = sortedFuelEntries.filter(l => l.odometer! > startFullTank.odometer! && l.odometer! <= endFullTank.odometer!);
        const litersInCycle = entriesInCycle.reduce((acc, l) => acc + (l.fuel_liters || 0), 0);
        
        if (litersInCycle > 0 && distance > 0) {
          mediaKmL = (distance / litersInCycle).toFixed(2);
        }
      } else {
        // Fallback to simple average
        let totalLitros = 0;
        let kmRodadoCombustivel = 0;
        sortedFuelEntries.forEach((entry, index) => {
          totalLitros += Number(entry.fuel_liters);
          const prevOdometer = index > 0 ? sortedFuelEntries[index - 1].odometer! : (vehicle.initial_odometer || 0);
          const distance = entry.odometer! - prevOdometer;
          if (distance > 0) kmRodadoCombustivel += distance;
        });
        if (totalLitros > 0 && kmRodadoCombustivel > 0) {
          mediaKmL = (kmRodadoCombustivel / totalLitros).toFixed(2);
        }
      }

      if (mediaKmL !== '0.0') {
        setCalcConsumption(mediaKmL.replace('.', ','));
      }
    }

    // Auto-set profit goal if vehicle has one
    if (vehicle.profit_goal) {
      const goal = calcMode === 'monthly' 
        ? vehicle.profit_goal 
        : (vehicle.profit_goal / 30) * 7;
      setCalcProfitGoal(formatCurrency(goal));
    }
  }, [calcVehicleId, vehicles, lancamentos, calcMode]);

  React.useEffect(() => {
    setProfileNome(user.nome || '');
    setProfileTelefone(user.telefone || '');
  }, [user]);

  React.useEffect(() => {
    if (forceOpenProfile) {
      setIsProfileOpen(true);
      onProfileOpened?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [forceOpenProfile, onProfileOpened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    if (!editingId && !isPremium(user)) {
      const customCategoriesCount = categorias.filter(c => !c.is_system_default).length;
      if (customCategoriesCount >= 5) {
        setPremiumFeatureName('Categorias Personalizadas Ilimitadas');
        setIsPremiumModalOpen(true);
        return;
      }
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome, tipo })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert([{ user_id: user.id, nome, tipo }]);
        if (error) throw error;
      }

      setNome('');
      setTipo('despesa');
      setEditingId(null);
      setIsCategoryFormOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setNome(cat.nome);
    setTipo(cat.tipo);
    setIsCategoryFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('categorias').delete().eq('id', deletingId);
      if (error) throw error;
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir categoria. Verifique se há lançamentos vinculados.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword) {
      setErrorMsg('Por favor, informe sua senha atual.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('A nova senha e a confirmação não coincidem.');
      return;
    }

    setPasswordLoading(true);
    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Senha atual incorreta.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setSuccessMsg('Senha atualizada com sucesso!');
      setNewPassword('');
      setCurrentPassword('');
      setConfirmPassword('');
      setIsPasswordFormOpen(false);
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          nome: profileNome,
          telefone: profileTelefone
        }
      });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: profileNome,
          telefone: profileTelefone
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setSuccessMsg('Perfil atualizado com sucesso!');
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar perfil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenNewShift = () => {
    setEditingShiftId(null);
    setShiftDate(format(new Date(), 'yyyy-MM-dd'));
    setShiftStartTime(format(new Date(), 'HH:mm'));
    setShiftEndTime('');
    setShiftOdometer('');
    setShiftVehicleId('');
    setShiftType('work');
    setShiftModalOpen(true);
  };

  const handleEditShift = (shift: WorkShift) => {
    setEditingShiftId(shift.id);
    setShiftDate(shift.date);
    setShiftStartTime(shift.start_time);
    setShiftEndTime(shift.end_time || '');
    setShiftOdometer(shift.odometer ? shift.odometer.toString() : '');
    setShiftVehicleId(shift.vehicle_id || '');
    setShiftType(shift.type || 'work');
    setShiftModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!shiftDate || !shiftStartTime || !shiftVehicleId) {
      setErrorMsg('Data, horário de início e veículo são obrigatórios.');
      return;
    }

    if (shiftEndTime && shiftEndTime < shiftStartTime) {
      setErrorMsg('O horário de término não pode ser anterior ao horário de início.');
      return;
    }

    setShiftLoading(true);
    try {
      if (editingShiftId) {
        const { error } = await supabase
          .from('work_shifts')
          .update({
            date: shiftDate,
            start_time: shiftStartTime,
            end_time: shiftEndTime || null,
            odometer: shiftOdometer ? Number(shiftOdometer) : null,
            vehicle_id: shiftVehicleId,
            type: shiftType
          })
          .eq('id', editingShiftId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('work_shifts')
          .insert([{
            user_id: user.id,
            date: shiftDate,
            start_time: shiftStartTime,
            end_time: shiftEndTime || null,
            odometer: shiftOdometer ? Number(shiftOdometer) : null,
            vehicle_id: shiftVehicleId,
            type: shiftType
          }]);
        if (error) throw error;
      }

      setShiftModalOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar turno.');
    } finally {
      setShiftLoading(false);
    }
  };

  const confirmDeleteShift = (id: string) => {
    setDeletingShiftId(id);
    setDeleteShiftModalOpen(true);
  };

  const handleDeleteShift = async () => {
    if (!deletingShiftId) return;
    try {
      const { error } = await supabase.from('work_shifts').delete().eq('id', deletingShiftId);
      if (error) throw error;
      setDeleteShiftModalOpen(false);
      setDeletingShiftId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir turno.');
    }
  };

  const receitas = categorias.filter((c) => c.tipo === 'receita');
  const { theme, setTheme } = useTheme();

  const despesas = categorias.filter((c) => c.tipo === 'despesa');

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
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
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
              {isProfileOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
          
          {isProfileOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-center mb-8">
                <ProfilePhotoUpload user={user} onUpdate={refetch} />
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                    <Input 
                      type="text" 
                      value={profileNome} 
                      onChange={(e) => setProfileNome(e.target.value)} 
                      placeholder="Seu nome completo" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
                    <Input 
                      type="tel" 
                      inputMode="tel"
                      value={profileTelefone} 
                      onChange={(e) => setProfileTelefone(e.target.value)} 
                      placeholder="(00) 00000-0000" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <Input type="email" value={user.email} disabled className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400" />
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">O email não pode ser alterado.</p>
                </div>
                <Button type="submit" disabled={profileLoading} className="w-full sm:w-auto">
                  {profileLoading ? 'Salvando...' : 'Salvar Detalhes'}
                </Button>
              </form>

              <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setIsPasswordFormOpen(!isPasswordFormOpen)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alterar Senha</h4>
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                    {isPasswordFormOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isPasswordFormOpen && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Senha Atual</label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Sua senha atual"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Senha</label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Nova Senha</label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repita a nova senha"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
                      {passwordLoading ? 'Atualizando...' : 'Atualizar Senha'}
                    </Button>
                  </form>
                )}
              </div>

              <div className="space-y-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Aparência</h4>
                </div>
                <div 
                  onClick={() => {
                    const currentTheme = theme === "system" 
                      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
                      : theme;
                    setTheme(currentTheme === "light" ? "dark" : "light");
                  }}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Modo Escuro</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Alterne entre o tema claro e escuro</p>
                  </div>
                  <div className="flex items-center justify-center rounded-lg p-2 text-gray-500 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100 transition-colors">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsPlanOpen(!isPlanOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Meu Plano</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.premium_status === 'pending' ? 'Assinatura em Análise ⏳' : (isPremium(user) ? 'Você é Premium 🌟' : 'Plano Gratuito')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              {isPlanOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isPlanOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${user.premium_status === 'pending' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30' : (isPremium(user) ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700')}`}>
                  <h4 className={`font-semibold mb-2 ${user.premium_status === 'pending' ? 'text-amber-800 dark:text-amber-300' : (isPremium(user) ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-300')}`}>
                    {user.premium_status === 'pending' ? 'Assinatura em Análise' : (isPremium(user) ? 'Plano Premium Ativo' : 'Plano Gratuito')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {user.premium_status === 'pending' 
                      ? 'Seu pagamento está sendo analisado. Seu acesso será liberado assim que o pagamento for confirmado.'
                      : (isPremium(user) 
                        ? 'Você tem acesso a todas as funcionalidades do Atlas Financeiro, incluindo veículos ilimitados e exportação de relatórios.'
                        : 'Faça o upgrade para desbloquear veículos ilimitados, exportação de relatórios e muito mais.')}
                  </p>
                  
                  {!isPremium(user) && user.premium_status !== 'pending' ? (
                    <Button 
                      onClick={onNavigateToPremium} 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      Ver Planos Premium
                    </Button>
                  ) : (
                    <Button 
                      onClick={onNavigateToPremium} 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {user.premium_status === 'pending' ? 'Acompanhar Assinatura' : 'Estender Assinatura'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {!isPremium(user) && (
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
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">Meus Veículos</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie seus veículos e manutenções</p>
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
            onClick={() => setIsSupportSectionOpen(!isSupportSectionOpen)}
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
              {isSupportSectionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isSupportSectionOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
              <Button 
                onClick={onNavigateToSuporte}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir Chamado no App
              </Button>

              {isPremium(user) && (
                <Button 
                  variant="outline"
                  className="w-full border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center justify-center gap-2"
                  onClick={() => window.open('https://wa.me/5545999935856', '_blank')}
                >
                  <MessageCircle className="h-4 w-4" />
                  Suporte Premium (WhatsApp)
                </Button>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsCalcOpen(!isCalcOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Calculadora de Ganhos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Planeje sua semana e descubra seu valor mínimo por KM</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              {isCalcOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isCalcOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Mode Toggle */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full max-w-xs mx-auto mb-8">
                <button
                  onClick={() => {
                    setCalcMode('weekly');
                    setCalcDaysPerWeek('5');
                  }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    calcMode === 'weekly' 
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => {
                    setCalcMode('monthly');
                    setCalcDaysPerWeek('22');
                  }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    calcMode === 'monthly' 
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  Mensal
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo para Análise</label>
                    <CustomSelect
                      value={calcVehicleId}
                      onChange={setCalcVehicleId}
                      placeholder="Selecione um veículo"
                      options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))}
                    />
                  </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Dias de Trabalho / {calcMode === 'weekly' ? 'Semana' : 'Mês'}
                        </label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={calcDaysPerWeek}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9,]/g, '');
                            setCalcDaysPerWeek(val);
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta KM / Dia</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={calcKmPerDay}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9,]/g, '');
                            setCalcKmPerDay(val);
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Meta de Lucro Líquido / {calcMode === 'weekly' ? 'Semana' : 'Mês'}
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={calcProfitGoal}
                      onChange={(e) => setCalcProfitGoal(formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preço Combustível (L)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={calcFuelPrice}
                        onChange={(e) => setCalcFuelPrice(formatCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Consumo (KM/L)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={calcConsumption}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9,]/g, '');
                          setCalcConsumption(val);
                        }}
                        placeholder="0,0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Outros Custos Fixos Mensais (Seguro, IPVA...)</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={calcOtherFixed}
                      onChange={(e) => setCalcOtherFixed(formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>

                {/* Results */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
                  {!calcVehicleId ? (
                    <div className="text-center space-y-3">
                      <Calculator className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Selecione um veículo para ver os resultados.</p>
                    </div>
                  ) : calculatorResults && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Valor Mínimo por KM</p>
                        <h4 className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                          R$ {calculatorResults.minPricePerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <p className="text-xs text-gray-500 mt-2 italic">Aceite corridas acima deste valor para atingir sua meta.</p>
                      </div>

                      <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">KM Total / {calcMode === 'weekly' ? 'Semana' : 'Mês'}</span>
                          <span className="font-semibold">{calculatorResults.totalKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Custo Combustível / {calcMode === 'weekly' ? 'Semana' : 'Mês'}</span>
                          <span className="font-semibold text-red-500">R$ {calculatorResults.fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {!calculatorResults.isRented && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Reserva Manutenção / {calcMode === 'weekly' ? 'Semana' : 'Mês'}</span>
                            <span className="font-semibold text-red-500">R$ {calculatorResults.maintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Custos Fixos / {calcMode === 'weekly' ? 'Semana' : 'Mês'}</span>
                          <span className="font-semibold text-red-500">R$ {calculatorResults.fixedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Consumo Médio</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{Number(calcConsumption.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM/L</span>
                        </div>
                        <div className="pt-3 flex justify-between text-base font-bold border-t border-dashed border-gray-300 dark:border-gray-600">
                          <span className="text-gray-900 dark:text-white">Receita Necessária / {calcMode === 'weekly' ? 'Semana' : 'Mês'}</span>
                          <span className="text-emerald-600 dark:text-emerald-400">R$ {calculatorResults.totalRevenueNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="pt-2 flex justify-between text-sm font-medium">
                          <span className="text-gray-600 dark:text-gray-400">Meta de Ganhos Brutos / Dia</span>
                          <span className="text-emerald-600 dark:text-emerald-400">R$ {calculatorResults.dailyGrossTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsFeaturesSectionOpen(!isFeaturesSectionOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Funcionalidades</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Conheça todos os recursos do Atlas Financeiro</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
              {isFeaturesSectionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isFeaturesSectionOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-3">
                {featuresList.map((feature) => (
                  <div key={feature.id} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          {feature.icon}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{feature.title}</span>
                      </div>
                      {expandedFeature === feature.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    
                    {expandedFeature === feature.id && (
                      <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="pl-11 pr-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsShiftsOpen(!isShiftsOpen)}
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
              {isShiftsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isShiftsOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Meus Turnos</h4>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={showShiftFilters ? "default" : "outline"}
                    size="sm" 
                    onClick={() => setShowShiftFilters(!showShiftFilters)}
                    className={showShiftFilters ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 border-transparent" : ""}
                  >
                    <Filter className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Filtros</span>
                  </Button>
                  <Button onClick={handleOpenNewShift} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Adicionar Turno
                  </Button>
                </div>
              </div>

              {showShiftFilters && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500" /> Período
                      </label>
                      <CustomSelect
                        value={shiftFilterTime}
                        onChange={(val) => setShiftFilterTime(val as any)}
                        options={[
                          { value: 'today', label: 'Hoje' },
                          { value: 'week', label: 'Última semana' },
                          { value: 'month', label: 'Último mês' },
                          { value: 'year', label: 'Último ano' },
                          { value: 'custom', label: 'Personalizado' }
                        ]}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Car className="h-4 w-4 text-indigo-500" /> Veículo
                      </label>
                      <CustomSelect
                        value={shiftFilterVehicle}
                        onChange={setShiftFilterVehicle}
                        options={[
                          { value: 'all', label: 'Todos os veículos' },
                          ...vehicles.map(v => ({ value: v.id, label: v.name }))
                        ]}
                      />
                    </div>
                  </div>

                  {shiftFilterTime === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Inicial</label>
                        <Input
                          type="date"
                          value={shiftFilterStartDate}
                          onChange={(e) => setShiftFilterStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Final</label>
                        <Input
                          type="date"
                          value={shiftFilterEndDate}
                          onChange={(e) => setShiftFilterEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {filteredShifts.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum turno encontrado para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredShifts.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(shift.date + 'T00:00:00'), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {shift.start_time.slice(0, 5)} - {shift.end_time ? shift.end_time.slice(0, 5) : 'Em andamento'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditShift(shift)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmDeleteShift(shift.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {!hasCategories && (
          <OnboardingGuide
            step="category"
            title="Crie suas categorias"
            description="Organize suas finanças! Crie categorias personalizadas como 'Alimentação' ou 'Impostos'."
            onClick={() => setIsCategoryFormOpen(true)}
            buttonText="Criar Categoria"
          />
        )}

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsCategoriesSectionOpen(!isCategoriesSectionOpen)}
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
              {isCategoriesSectionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>

          {isCategoriesSectionOpen && (
            <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200 space-y-6">
              <Card className="border shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setIsCategoryFormOpen(!isCategoryFormOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F59E0B]/10 rounded-lg">
                      {!isPremium(user) && categorias.filter(c => !c.is_system_default).length >= 5 ? (
                        <Lock className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Settings className="h-5 w-5 text-[#F59E0B]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Cadastre ou edite categorias de lançamentos</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-gray-400 dark:text-gray-500">
                    {isCategoryFormOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </div>

                {isCategoryFormOpen && (
                  <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Categoria</label>
                          <Input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Alimentação, Salário..."
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                          <CustomSelect 
                            value={tipo} 
                            onChange={(val) => setTipo(val as TipoLancamento)}
                            options={[
                              { value: 'despesa', label: 'Despesa' },
                              { value: 'receita', label: 'Receita' }
                            ]}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        {editingId && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setNome('');
                              setTipo('despesa');
                              setIsCategoryFormOpen(false);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706]">
                          {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Categoria'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                )}
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border shadow-sm bg-white dark:bg-gray-900">
                  <CardHeader className="pb-4 border-b border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-red-50 dark:bg-[#EF4444]/20 rounded-lg">
                        <Tag className="h-5 w-5 text-[#EF4444] dark:text-[#F87171]" />
                      </div>
                      <CardTitle className="text-[#EF4444] dark:text-[#F87171]">Categorias de Despesa</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ul className="space-y-2">
                      {despesas.length === 0 ? (
                        <li className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma categoria cadastrada.</li>
                      ) : (
                        despesas.map((cat) => (
                          <li
                            key={cat.id}
                            className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                              {cat.is_system_default && (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">Padrão</span>
                              )}
                            </div>
                            {!cat.is_system_default && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEdit(cat)}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#F59E0B] dark:hover:text-[#FBBF24] hover:bg-orange-50 dark:hover:bg-[#F59E0B]/10 rounded-md transition-colors"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => confirmDelete(cat.id)}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#EF4444] dark:hover:text-[#F87171] hover:bg-red-50 dark:hover:bg-[#EF4444]/10 rounded-md transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm bg-white dark:bg-gray-900">
                  <CardHeader className="pb-4 border-b border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-50 dark:bg-[#10B981]/20 rounded-lg">
                        <Tag className="h-5 w-5 text-[#059568] dark:text-[#10B981]" />
                      </div>
                      <CardTitle className="text-[#059568] dark:text-[#10B981]">Categorias de Receita</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ul className="space-y-2">
                      {receitas.length === 0 ? (
                        <li className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma categoria cadastrada.</li>
                      ) : (
                        receitas.map((cat) => (
                          <li
                            key={cat.id}
                            className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                              {cat.is_system_default && (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">Padrão</span>
                              )}
                            </div>
                            {!cat.is_system_default && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEdit(cat)}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#F59E0B] dark:hover:text-[#FBBF24] hover:bg-orange-50 dark:hover:bg-[#F59E0B]/10 rounded-md transition-colors"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => confirmDelete(cat.id)}
                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#EF4444] dark:hover:text-[#F87171] hover:bg-red-50 dark:hover:bg-[#EF4444]/10 rounded-md transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Tem certeza que deseja excluir esta categoria? Não será possível excluir se houver lançamentos vinculados a ela.
        </p>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
            Confirmar Exclusão
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={shiftModalOpen}
        onClose={() => {
          setShiftModalOpen(false);
          setErrorMsg('');
        }}
        title={editingShiftId ? "Editar Turno" : "Adicionar Turno"}
        className="max-w-md"
      >
        <form onSubmit={handleSaveShift} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data *</label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Turno *</label>
              <CustomSelect
                value={shiftType}
                onChange={(val) => setShiftType(val as 'work' | 'personal')}
                options={[
                  { value: 'work', label: 'Trabalho' },
                  { value: 'personal', label: 'Pessoal' }
                ]}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo *</label>
            <CustomSelect
              value={shiftVehicleId}
              onChange={setShiftVehicleId}
              options={vehicles
                .filter(v => v.status === 'active' || v.id === shiftVehicleId)
                .map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Início *</label>
              <Input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Término (Opcional)</label>
              <Input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KM Rodados no Turno (Opcional)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={shiftOdometer}
              onChange={(e) => setShiftOdometer(e.target.value)}
              placeholder="Ex: 150"
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setShiftModalOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={shiftLoading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
              {shiftLoading ? 'Salvando...' : 'Salvar Turno'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteShiftModalOpen}
        onClose={() => setDeleteShiftModalOpen(false)}
        title="Excluir Turno"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tem certeza que deseja excluir este turno? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteShiftModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteShift}>Excluir</Button>
          </div>
        </div>
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
