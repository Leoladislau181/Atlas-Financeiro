import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatCurrencyInput, parseCurrency, parseLocalDate } from '@/lib/utils';
import { Lancamento, Categoria, Vehicle, Manutencao, User, FuelType, WorkShift } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isPremium } from '@/lib/utils';
import { useFuelAutoFill } from '@/hooks/useFuelAutoFill';

import { ArrowUpCircle, ArrowDownCircle, DollarSign, Wallet, Filter, Zap, Fuel, AlertTriangle, CheckCircle, Camera, Clock, Briefcase, StopCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { supabase } from '@/lib/supabase';
import { PremiumModal } from '@/components/premium-modal';
import { OnboardingGuide } from '@/components/onboarding-guide';

interface DashboardProps {
  lancamentos: Lancamento[];
  categorias: Categoria[];
  vehicles: Vehicle[];
  manutencoes: Manutencao[];
  workShifts: WorkShift[];
  refetch: () => void;
  user: User;
  onNavigate?: (tab: string) => void;
}

export function Dashboard({ lancamentos, categorias, vehicles, manutencoes, workShifts, refetch, user, onNavigate }: DashboardProps) {
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
  const [quickShiftId, setQuickShiftId] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  // Income Entry States
  const [incomeEntryOpen, setIncomeEntryOpen] = useState(false);
  const [incomeValueStr, setIncomeValueStr] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [incomeVehicleId, setIncomeVehicleId] = useState('');
  const [incomeShiftId, setIncomeShiftId] = useState<string | null>(null);
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

  // Shift states
  const [shiftEntryOpen, setShiftEntryOpen] = useState(false);
  const [shiftMode, setShiftMode] = useState<'open' | 'close'>('open');
  const [shiftDate, setShiftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState('');
  const [shiftOdometer, setShiftOdometer] = useState('');
  const [shiftVehicleId, setShiftVehicleId] = useState('');
  const [shiftType, setShiftType] = useState<'work' | 'personal'>('work');
  const [shiftGoal, setShiftGoal] = useState('');
  const [shiftStartOdometer, setShiftStartOdometer] = useState('');
  const [shiftEndOdometer, setShiftEndOdometer] = useState('');
  const [shiftLoading, setShiftLoading] = useState(false);

  // Summary States
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState<WorkShift | null>(null);

  // Pause States
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseDuration, setPauseDuration] = useState('60');

  const openShift = useMemo(() => {
    return workShifts.find(s => s.status === 'open' || s.status === 'paused' || !s.end_time);
  }, [workShifts]);

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
    // Lazy Evaluation for Paused Shifts
    const checkPausedShifts = async () => {
      const pausedShift = workShifts.find(s => s.status === 'paused');
      if (pausedShift && pausedShift.paused_at && pausedShift.pause_duration_minutes) {
        const pausedAt = new Date(pausedShift.paused_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - pausedAt.getTime()) / (1000 * 60);
        
        if (diffMinutes > pausedShift.pause_duration_minutes) {
          // Auto-close shift at the time it was paused
          const endTime = format(pausedAt, 'HH:mm');
          const { data: updatedShift, error } = await supabase
            .from('work_shifts')
            .update({ 
              status: 'closed',
              end_time: endTime
            })
            .eq('id', pausedShift.id)
            .select()
            .single();
          
          if (!error && updatedShift) {
            setClosedShiftData(updatedShift);
            setSummaryModalOpen(true);
          }
          refetch();
        }
      }
    };

    if (workShifts.length > 0) {
      checkPausedShifts();
    }
  }, [workShifts]);

  useEffect(() => {
    if (vehicles.length > 0) {
      const activeVehicle = vehicles.find(v => v.status === 'active') || vehicles[0];
      setQuickVehicleId(activeVehicle.id);
      if (!shiftVehicleId) {
        setShiftVehicleId(activeVehicle.id);
      }
    }
  }, [vehicles, quickEntryOpen]);

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
      } else {
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

  const handleOpenShift = () => {
    const now = new Date();
    setShiftDate(format(now, 'yyyy-MM-dd'));
    setShiftStartTime(format(now, 'HH:mm'));
    setShiftEndTime('');
    setShiftStartOdometer('');
    setShiftEndOdometer('');
    setShiftGoal('');
    setShiftType('work');
    
    if (vehicles.length > 0) {
      const activeVehicle = vehicles.find(v => v.status === 'active') || vehicles[0];
      setShiftVehicleId(activeVehicle.id);
      
      // Intelligent Odometer: Find the last shift for this vehicle
      const lastShift = [...workShifts]
        .filter(s => s.vehicle_id === activeVehicle.id && s.end_odometer)
        .sort((a, b) => new Date(b.date + 'T' + b.start_time).getTime() - new Date(a.date + 'T' + a.start_time).getTime())[0];
      
      if (lastShift && lastShift.end_odometer) {
        setShiftStartOdometer(lastShift.end_odometer.toString());
      }
    }
    setShiftMode('open');
    setShiftEntryOpen(true);
  };

  const handleOpenCloseShift = () => {
    if (!openShift) return;
    const now = new Date();
    setShiftDate(openShift.date);
    setShiftStartTime(openShift.start_time);
    setShiftEndTime(format(now, 'HH:mm'));
    setShiftStartOdometer(openShift.start_odometer?.toString() || '');
    setShiftEndOdometer('');
    setShiftVehicleId(openShift.vehicle_id || '');
    setShiftType(openShift.type || 'work');
    setShiftGoal(openShift.goal?.toString() || '');
    setShiftMode('close');
    setShiftEntryOpen(true);
  };

  const handleShiftEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (shiftMode === 'open') {
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
        const { error } = await supabase
          .from('work_shifts')
          .insert([{
            user_id: user.id,
            vehicle_id: shiftVehicleId,
            type: shiftType,
            date: shiftDate,
            start_time: shiftStartTime,
            end_time: shiftEndTime || null,
            start_odometer: shiftStartOdometer ? Number(shiftStartOdometer) : null,
            goal: shiftGoal ? Number(shiftGoal) : null,
            status: 'open'
          }]);

        if (error) throw error;

        setShiftEntryOpen(false);
        refetch();
      } catch (error: any) {
        setErrorMsg(error.message || 'Erro ao registrar turno.');
      } finally {
        setShiftLoading(false);
      }
    } else {
      if (!shiftEndTime) {
        setErrorMsg('O horário de término é obrigatório para encerrar o turno.');
        return;
      }

      if (shiftDate === openShift?.date && shiftEndTime < shiftStartTime) {
        setErrorMsg('O horário de término não pode ser anterior ao horário de início.');
        return;
      }

      setShiftLoading(true);
      try {
        const { data: updatedShift, error } = await supabase
          .from('work_shifts')
          .update({ 
            end_time: shiftEndTime,
            end_odometer: shiftEndOdometer ? Number(shiftEndOdometer) : null,
            vehicle_id: shiftVehicleId,
            type: shiftType,
            status: 'closed'
          })
          .eq('id', openShift?.id)
          .select()
          .single();

        if (error) throw error;

        setShiftEntryOpen(false);
        setClosedShiftData(updatedShift);
        setSummaryModalOpen(true);
        refetch();
      } catch (error: any) {
        setErrorMsg(error.message || 'Erro ao encerrar turno.');
      } finally {
        setShiftLoading(false);
      }
    }
  };

  const handlePauseShift = async () => {
    if (!openShift) return;
    setShiftLoading(true);
    try {
      const { error } = await supabase
        .from('work_shifts')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_duration_minutes: Number(pauseDuration)
        })
        .eq('id', openShift.id);
      if (error) throw error;
      setPauseModalOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao pausar turno.');
    } finally {
      setShiftLoading(false);
    }
  };

  const handleResumeShift = async () => {
    if (!openShift) return;
    setShiftLoading(true);
    try {
      const { error } = await supabase
        .from('work_shifts')
        .update({
          status: 'open',
          paused_at: null,
          pause_duration_minutes: null
        })
        .eq('id', openShift.id);
      if (error) throw error;
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao retomar turno.');
    } finally {
      setShiftLoading(false);
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
          shift_id: incomeShiftId || null,
          observacao: incomeShiftId ? 'Ganhos vinculados ao turno' : 'Lançamento de ganhos'
        }]);

      if (error) throw error;

      setIncomeEntryOpen(false);
      setIncomeValueStr('');
      setIncomeShiftId(null);
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resumo</h2>
        <div className="flex items-center gap-2">
          {openShift && openShift.status === 'paused' ? (
            <Button 
              onClick={handleResumeShift}
              disabled={shiftLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Retomar Turno</span>
              <span className="sm:hidden">Retomar</span>
            </Button>
          ) : openShift && openShift.status === 'open' ? (
            <Button 
              onClick={() => setPauseModalOpen(true)}
              disabled={shiftLoading}
              variant="outline"
              className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shadow-sm gap-2"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pausar Turno</span>
              <span className="sm:hidden">Pausar</span>
            </Button>
          ) : null}

          <Button 
            onClick={openShift ? handleOpenCloseShift : handleOpenShift}
            disabled={shiftLoading}
            className={`${openShift ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white shadow-sm gap-2`}
          >
            {openShift ? <StopCircle className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
            <span className="hidden sm:inline">{openShift ? 'Encerrar Turno' : 'Turno'}</span>
            <span className="sm:hidden">{openShift ? 'Encerrar' : 'Turno'}</span>
          </Button>
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

      {maintenanceAlerts.length > 0 && (
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
                      ? ` Passou ${Math.abs(alert.kmFaltante).toLocaleString('pt-BR')} km do limite.` 
                      : ` Faltam apenas ${alert.kmFaltante.toLocaleString('pt-BR')} km.`}
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        <Card className="col-span-2 md:col-span-1 border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-4">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <DollarSign className={`h-6 w-6 md:h-6 md:w-6 ${stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`} />
            <CardTitle className="text-base md:text-lg font-medium text-gray-500 dark:text-gray-400">Saldo</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div
              className={`text-3xl md:text-4xl font-bold break-words ${
                stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'
              }`}
            >
              {formatCurrency(stats.lucroLiquido)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-4">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <ArrowUpCircle className="h-5 w-5 md:h-6 md:w-6 text-[#059568] dark:text-[#10B981]" />
            <CardTitle className="text-sm md:text-lg font-medium text-gray-500 dark:text-gray-400">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-lg md:text-3xl font-bold text-[#059568] dark:text-[#10B981] break-words">
              {formatCurrency(stats.receitasMes)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-4">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <ArrowDownCircle className="h-5 w-5 md:h-6 md:w-6 text-[#EF4444] dark:text-[#F87171]" />
            <CardTitle className="text-sm md:text-lg font-medium text-gray-500 dark:text-gray-400">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-lg md:text-3xl font-bold text-[#EF4444] dark:text-[#F87171] break-words">
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
        <CardContent className="pl-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-gray-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-gray-500 dark:text-gray-400" dy={10} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-gray-500 dark:text-gray-400"
                  dx={-10}
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo</label>
            <CustomSelect 
              value={quickVehicleId} 
              onChange={setQuickVehicleId}
              options={[
                { value: '', label: 'Selecione um veículo' },
                ...vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
              ]}
            />
          </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <Modal
        isOpen={shiftEntryOpen}
        onClose={() => {
          setShiftEntryOpen(false);
          setErrorMsg('');
        }}
        title={shiftMode === 'open' ? "Registrar Turno" : "Encerrar Turno"}
        className="max-w-md"
      >
        <form onSubmit={handleShiftEntry} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data *</label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
              disabled={shiftMode === 'close'}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo *</label>
              <CustomSelect
                value={shiftVehicleId}
                onChange={setShiftVehicleId}
                options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))}
                disabled={shiftMode === 'close'}
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
                disabled={shiftMode === 'close'}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Início *</label>
              <Input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                required
                disabled={shiftMode === 'close'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Término {shiftMode === 'open' ? '(Opcional)' : '*'}</label>
              <Input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                required={shiftMode === 'close'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {shiftMode === 'open' ? 'KM Inicial (Opcional)' : 'KM Inicial'}
              </label>
              <Input
                type="number"
                inputMode="numeric"
                value={shiftStartOdometer}
                onChange={(e) => setShiftStartOdometer(e.target.value)}
                placeholder="0"
                disabled={shiftMode === 'close'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {shiftMode === 'open' ? 'Meta do Turno (Opcional)' : 'Meta do Turno'}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={shiftGoal ? formatCurrencyInput(shiftGoal.toString()) : ''}
                onChange={(e) => setShiftGoal(parseCurrency(formatCurrencyInput(e.target.value)).toString())}
                placeholder="R$ 0,00"
                disabled={shiftMode === 'close'}
              />
            </div>
          </div>

          {shiftMode === 'close' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KM Final (Opcional)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={shiftEndOdometer}
                onChange={(e) => setShiftEndOdometer(e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setShiftEntryOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={shiftLoading} className={`w-full sm:w-auto ${shiftMode === 'open' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white`}>
              {shiftLoading ? 'Salvando...' : (shiftMode === 'open' ? 'Iniciar Turno' : 'Encerrar Turno')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        title="Pausar Turno"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quanto tempo você pretende ficar em pausa? Se o tempo for excedido, o turno será encerrado automaticamente.
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Duração da Pausa</label>
            <CustomSelect
              value={pauseDuration}
              onChange={setPauseDuration}
              options={[
                { value: '15', label: '15 minutos' },
                { value: '30', label: '30 minutos' },
                { value: '60', label: '1 hora' },
                { value: '120', label: '2 horas' },
                { value: '180', label: '3 horas' },
              ]}
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button 
              onClick={handlePauseShift} 
              disabled={shiftLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {shiftLoading ? 'Pausando...' : 'Confirmar Pausa'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setPauseModalOpen(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        title="Resumo do Turno"
        className="max-w-md"
      >
        <div className="space-y-6 py-2">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Turno Finalizado!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Bom descanso, você merece.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duração</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {closedShiftData ? (() => {
                  const start = new Date(`2000-01-01T${closedShiftData.start_time}`);
                  const end = new Date(`2000-01-01T${closedShiftData.end_time}`);
                  const diff = (end.getTime() - start.getTime()) / (1000 * 60);
                  const hours = Math.floor(diff / 60);
                  const minutes = Math.floor(diff % 60);
                  return `${hours}h ${minutes}m`;
                })() : '-'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Distância</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {closedShiftData && closedShiftData.start_odometer && closedShiftData.end_odometer 
                  ? `${(closedShiftData.end_odometer - closedShiftData.start_odometer).toFixed(1)} km`
                  : '-'}
              </p>
            </div>
          </div>

          {closedShiftData?.goal && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Meta do Turno</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{formatCurrency(closedShiftData.goal)}</p>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <p className="text-[10px] text-indigo-500 mt-2 italic">Lance seus ganhos para ver o progresso da meta.</p>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <Button 
              onClick={() => {
                setSummaryModalOpen(false);
                setIncomeShiftId(closedShiftData?.id || null);
                setIncomeVehicleId(closedShiftData?.vehicle_id || '');
                setIncomeValueStr('');
                // Set default income category
                const defaultCat = categorias.find(c => c.tipo === 'receita' && !c.is_system_default) || 
                                   categorias.find(c => c.tipo === 'receita');
                if (defaultCat) setIncomeCategoryId(defaultCat.id);
                setIncomeEntryOpen(true);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg shadow-lg shadow-emerald-200 dark:shadow-none"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Lançar Ganhos do Turno
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setSummaryModalOpen(false)}
              className="w-full text-gray-500"
            >
              Fechar sem lançar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={incomeEntryOpen}
        onClose={() => setIncomeEntryOpen(false)}
        title="Lançar Ganhos do Turno"
        className="max-w-md"
      >
        <form onSubmit={handleIncomeEntry} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Total de Ganhos *</label>
            <Input
              type="text"
              inputMode="decimal"
              value={incomeValueStr}
              onChange={(e) => setIncomeValueStr(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="text-2xl font-bold text-center py-6"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria *</label>
            <CustomSelect
              value={incomeCategoryId}
              onChange={setIncomeCategoryId}
              options={categorias
                .filter(c => c.tipo === 'receita')
                .map(c => ({ value: c.id, label: c.nome }))
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo</label>
            <CustomSelect
              value={incomeVehicleId}
              onChange={setIncomeVehicleId}
              options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))}
            />
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <Button 
              type="submit" 
              disabled={incomeLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {incomeLoading ? 'Salvando...' : 'Confirmar Ganhos'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setIncomeEntryOpen(false)}
              className="w-full"
            >
              Cancelar
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
