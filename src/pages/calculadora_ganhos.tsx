import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Vehicle, Lancamento, User, CalculatorGoal } from '@/types';
import { Calculator, ChevronLeft, X, DollarSign, Target, TrendingUp, CheckCircle2, Trash2, Calendar as CalendarIcon, History, ArrowRight, Wallet, Fuel, Car, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { formatCurrency, formatCurrencyInput, parseCurrency, getMostUsedVehicleId, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '@/components/ui/modal';

interface CalculadoraGanhosProps {
  user: User;
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  onBack: () => void;
  onBackToHome: () => void;
}

export function CalculadoraGanhos({ 
  user, 
  vehicles, 
  lancamentos, 
  onBack, 
  onBackToHome 
}: CalculadoraGanhosProps) {
  const [calcMode, setCalcMode] = useState<'weekly' | 'monthly'>('weekly');
  const [calcVehicleId, setCalcVehicleId] = useState('');
  const [calcDaysPerWeek, setCalcDaysPerWeek] = useState('5');
  const [calcKmPerDay, setCalcKmPerDay] = useState('150');
  const [calcProfitGoal, setCalcProfitGoal] = useState(formatCurrency(1000));
  const [calcFuelPrice, setCalcFuelPrice] = useState(formatCurrency(5.50));
  const [calcConsumption, setCalcConsumption] = useState('10');
  const [calcOtherFixed, setCalcOtherFixed] = useState(formatCurrency(0));
  
  const [goals, setGoals] = useState<CalculatorGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedGoalDate, setSelectedGoalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const mostUsedVehicleId = useMemo(() => getMostUsedVehicleId(vehicles, lancamentos), [vehicles, lancamentos]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('calculator_goals')
        .select('*, vehicles(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error('Error fetching goals:', err);
    } finally {
      setLoadingGoals(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [user.id]);

  const handleActivateGoal = async () => {
    if (!calculatorResults || !calcVehicleId) return;

    setErrorMsg('');
    setSuccessMsg('');

    const startDate = new Date(selectedGoalDate + 'T00:00:00');
    if (isNaN(startDate.getTime())) {
      setErrorMsg('Data de início inválida.');
      return;
    }

    setIsActivating(true);

    try {
      const startDate = new Date(selectedGoalDate + 'T00:00:00');
      // Weekly = 7 days total (start + 6 days)
      // Monthly = 30 days total (start + 29 days)
      const daysToAdd = calcMode === 'weekly' ? 6 : 29;
      const endDate = addDays(startDate, daysToAdd);

      const { error } = await supabase
        .from('calculator_goals')
        .insert([{
          user_id: user.id,
          vehicle_id: calcVehicleId,
          mode: calcMode,
          days_per_week: Number(calcDaysPerWeek.replace(',', '.')) || 0,
          km_per_day: Number(calcKmPerDay.replace(',', '.')) || 0,
          profit_goal: parseCurrency(calcProfitGoal) || 0,
          fuel_price: parseCurrency(calcFuelPrice) || 0,
          consumption: Number(calcConsumption.replace(',', '.')) || 0,
          other_fixed: parseCurrency(calcOtherFixed) || 0,
          min_price_per_km: calculatorResults.minPricePerKm,
          total_revenue_needed: calculatorResults.totalRevenueNeeded,
          daily_gross_target: calculatorResults.dailyGrossTarget,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd')
        }]);

      if (error) throw error;
      
      setSuccessMsg('Meta ativada com sucesso!');
      setIsDateModalOpen(false);
      fetchGoals();
      
      // Clear success message after 3s
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ativar meta.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('calculator_goals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error('Error deleting goal:', err);
    }
  };

  useEffect(() => {
    if (!calcVehicleId && vehicles.length > 0) {
      setCalcVehicleId(mostUsedVehicleId);
    }
  }, [vehicles, mostUsedVehicleId]);

  const calculatorResults = useMemo(() => {
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
  useEffect(() => {
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

      // Average consumption calculation
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

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              Calculadora de Ganhos
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Planeje sua meta e custos</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToHome}
          className="h-10 w-10 p-0 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden rounded-3xl">
        <CardContent className="p-4 sm:p-6">
          {/* Mode Toggle */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full max-w-xs mx-auto mb-8">
            <button
              onClick={() => {
                setCalcMode('weekly');
                setCalcDaysPerWeek('5');
              }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
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
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
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
              {vehicles.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo para Análise</label>
                  <CustomSelect
                    value={calcVehicleId}
                    onChange={setCalcVehicleId}
                    placeholder="Selecione um veículo"
                    options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))}
                  />
                </div>
              )}

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

                  <div className="pt-4 space-y-3">
                    {successMsg && (
                      <div className="p-3 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl border border-emerald-100 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="h-4 w-4" /> {successMsg}
                      </div>
                    )}
                    {errorMsg && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 animate-in shake duration-300">
                        {errorMsg}
                      </div>
                    )}
                    <Button 
                      onClick={() => {
                        setSelectedGoalDate(format(new Date(), 'yyyy-MM-dd'));
                        setIsDateModalOpen(true);
                      }}
                      disabled={isActivating || !calcVehicleId}
                      className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <Target className="h-6 w-6" />
                      ATIVAR META
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Selection Modal */}
      <Modal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        title="Quando a meta começa?"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selecione o dia de início da sua meta {calcMode === 'weekly' ? 'semanal' : 'mensal'}. 
              O sistema incluirá todos os lançamentos desse dia.
            </p>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Data de Início</label>
              <div 
                className="relative cursor-pointer"
                onClick={(e) => {
                  try {
                    const input = (e.currentTarget as HTMLElement).querySelector('input');
                    if (input && 'showPicker' in input) {
                      (input as any).showPicker();
                    } else if (input) {
                      input.focus();
                    }
                  } catch (err) {
                    console.warn('Erro ao abrir seletor de data:', err);
                  }
                }}
              >
                <Input
                  type="date"
                  value={selectedGoalDate}
                  onChange={(e) => setSelectedGoalDate(e.target.value)}
                  className="pl-10 h-12 rounded-xl cursor-pointer"
                />
                <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Início:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {(() => {
                    const d = new Date(selectedGoalDate + 'T12:00:00');
                    return isNaN(d.getTime()) ? 'Data inválida' : format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });
                  })()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Término:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-right">
                  {(() => {
                    const d = new Date(selectedGoalDate + 'T12:00:00');
                    if (isNaN(d.getTime())) return 'Data inválida';
                    const endDate = addDays(d, calcMode === 'weekly' ? 6 : 29);
                    return format(endDate, "dd/MM/yyyy (EEEE)", { locale: ptBR });
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {errorMsg && (
              <p className="text-xs font-bold text-red-500 text-center animate-in shake duration-300">
                {errorMsg}
              </p>
            )}
            <Button 
              onClick={handleActivateGoal}
              disabled={isActivating}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
            >
              {isActivating ? 'Salvando...' : 'Confirmar e Ativar'}
            </Button>
            <Button 
              variant="ghost"
              onClick={() => setIsDateModalOpen(false)}
              className="w-full h-12 rounded-xl text-gray-500"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Selected/Active Goals List */}
      <div className="space-y-4 mb-10">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Metas Ativas</h3>
        </div>

        {loadingGoals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : goals.filter(g => {
          if (!g.end_date) return true;
          const end = endOfDay(new Date(g.end_date + 'T23:59:59'));
          return end >= startOfDay(new Date());
        }).length === 0 ? (
          <Card className="border-dashed border-2 border-gray-200 dark:border-gray-800 bg-transparent shadow-none rounded-3xl">
            <CardContent className="p-10 text-center">
              <Target className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma meta ativa no momento. Calcule e clique em "Ativar Meta" para acompanhar seus objetivos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {goals.filter(g => {
              if (!g.end_date) return true;
              const end = endOfDay(new Date(g.end_date + 'T23:59:59'));
              return end >= startOfDay(new Date());
            }).map((goal) => {
              // Safety check for dates to prevent crashes
              if (!goal.start_date || !goal.end_date) return null;

              const goalStart = startOfDay(new Date(goal.start_date + 'T00:00:00'));
              const goalEnd = endOfDay(new Date(goal.end_date + 'T23:59:59'));
              const vehicle = goal.vehicles;

              if (isNaN(goalStart.getTime()) || isNaN(goalEnd.getTime())) return null;

              // Filter transactions for this vehicle in the specific goal period
              const periodTransactions = lancamentos.filter(l => {
                if (!l.data) return false;
                try {
                  const lDate = new Date(l.data + 'T12:00:00');
                  return l.vehicle_id === goal.vehicle_id && 
                    !isNaN(lDate.getTime()) &&
                    isWithinInterval(lDate, { start: goalStart, end: goalEnd });
                } catch (e) {
                  return false;
                }
              });

              // --- Realized values for the ENTIRE period ---
              // 1. Ganho Bruto
              const realGross = periodTransactions
                .filter(l => l.tipo === 'receita')
                .reduce((acc, l) => acc + Number(l.valor || 0), 0);
              
              // 2. Quilometragem
              const realKM = periodTransactions
                .reduce((acc, l) => acc + Number(l.km_rodados || 0), 0);

              // 3. Eficiência
              const realRevKm = realKM > 0 ? realGross / realKM : 0;

              // 4. Custos
              const fuelCostPerKm = goal.consumption > 0 ? goal.fuel_price / goal.consumption : 0;
              const realFuelCost = realKM * fuelCostPerKm;
              
              const isRented = vehicle?.type === 'rented';
              const maintReservePerKm = isRented ? 0 : (vehicle?.maintenance_reserve || 0.15);
              const realMaintCost = realKM * maintReservePerKm;

              const monthlyFixed = (isRented ? (vehicle?.contract_value || 0) : 0) + (goal.other_fixed || 0);
              const isMonthly = goal.mode === 'monthly';
              const periodFixedCost = isMonthly ? monthlyFixed : (monthlyFixed / 30) * 7;

              const realOtherExpenses = periodTransactions.filter(l => {
                if (l.tipo !== 'despesa') return false;
                const catName = l.categorias?.nome?.toLowerCase() || '';
                return !(catName.includes('combust') || catName.includes('alug') || catName.includes('rent') || catName.includes('manuten') || catName.includes('oficina'));
              }).reduce((acc, l) => acc + Number(l.valor || 0), 0);

              const realTotalCost = realFuelCost + realMaintCost + periodFixedCost + realOtherExpenses;

              // --- Meta values for the ENTIRE period ---
              const metaGross = goal.total_revenue_needed;
              const metaKM = goal.km_per_day * goal.days_per_week;
              const metaRevKm = goal.min_price_per_km;
              const metaCost = metaGross - goal.profit_goal;

              // Progress based on Profit (or choose Gross as common)
              // User mentioned "barra de progresso com a porcentagem"
              const realProfit = realGross - realTotalCost;
              const profitProgressRaw = goal.profit_goal > 0 ? (realProfit / goal.profit_goal) * 100 : 0;
              
              let profitColorClass = "bg-indigo-500";
              let profitTextClass = "text-indigo-600";
              let profitProgressWidthRaw = 0;

              if (realProfit < 0) {
                profitColorClass = "bg-red-500";
                profitTextClass = "text-red-500";
                profitProgressWidthRaw = realTotalCost > 0 ? (Math.abs(realProfit) / realTotalCost) * 100 : 0;
              } else if (realProfit >= goal.profit_goal) {
                profitColorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                profitTextClass = "text-emerald-500";
                profitProgressWidthRaw = 100;
              } else {
                profitColorClass = "bg-amber-500";
                profitTextClass = "text-amber-500";
                profitProgressWidthRaw = goal.profit_goal > 0 ? (realProfit / goal.profit_goal) * 100 : 0;
              }

              const profitProgressWidth = Math.min(100, Math.max(2, profitProgressWidthRaw));

              const grossProgress = Math.min(100, (realGross / (metaGross || 1)) * 100);

              const allGoalsMet = realGross >= metaGross && 
                                 realKM >= metaKM && 
                                 realRevKm >= metaRevKm && 
                                 realTotalCost <= metaCost;

              return (
                <Card key={goal.id} className="border-none shadow-md bg-white dark:bg-gray-900 overflow-hidden rounded-3xl relative group">
                  <CardContent className="p-0">
                    {/* Header with Title and Delete */}
                    <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap min-w-0">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg shrink-0">
                          <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest truncate">
                          {vehicle?.name}
                          <span className="hidden sm:inline text-gray-400 font-bold ml-1">
                            • {vehicle?.plate}
                          </span>
                          <span className="text-indigo-500 mx-1.5 font-bold">
                            • {goal.mode === 'weekly' ? 'Semanal' : 'Mensal'}
                          </span>
                          <span className="text-gray-500 font-bold">
                            • {format(goalStart, "dd/MM", { locale: ptBR })}
                            <span className="hidden sm:inline">
                              {' '}até {format(goalEnd, "dd/MM", { locale: ptBR })}
                            </span>
                          </span>
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="p-5 space-y-6">
                      {/* Overall Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-end px-1">
                          <p className="text-[10px] font-black text-indigo-600 uppercase">Progresso Geral (Meta de Lucro)</p>
                          <span className={cn(
                            "text-base font-black",
                            profitTextClass
                          )}>
                            {profitProgressRaw.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              profitColorClass
                            )}
                            style={{ width: `${profitProgressWidth}%` }}
                          />
                        </div>
                      </div>

                      {/* Comparison Columns - Unified Dashboard Style */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Metric 5: Lucro Líquido */}
                        <MetricComparison 
                          label="Lucro Líquido Real" 
                          metaValue={formatCurrency(goal.profit_goal)} 
                          realValue={formatCurrency(realProfit)} 
                          isMet={realProfit >= goal.profit_goal}
                          isNegative={realProfit < 0}
                        />

                        {/* Metric 1: Ganho Bruto */}
                        <MetricComparison 
                          label="Ganho Bruto Período" 
                          metaValue={formatCurrency(metaGross)} 
                          realValue={formatCurrency(realGross)} 
                          isMet={realGross >= metaGross}
                        />

                        {/* Metric 2: Quilometragem */}
                        <MetricComparison 
                          label="Quilometragem Período" 
                          metaValue={`${metaKM.toLocaleString()} KM`} 
                          realValue={`${realKM.toLocaleString()} KM`} 
                          isMet={realKM >= metaKM}
                        />

                        {/* Metric 3: Eficiência */}
                        <MetricComparison 
                          label="Eficiência (Rec/KM)" 
                          metaValue={formatCurrency(metaRevKm)} 
                          realValue={formatCurrency(realRevKm)} 
                          isMet={realRevKm >= metaRevKm}
                        />

                        {/* Metric 4: Custo Total */}
                        <MetricComparison 
                          label="Custo Total Período" 
                          metaValue={formatCurrency(metaCost)} 
                          realValue={formatCurrency(realTotalCost)} 
                          isMet={realTotalCost <= metaCost}
                          isCost
                        />
                      </div>

                      {/* Detail Footer */}
                      <div className="pt-2 flex flex-wrap gap-x-4 gap-y-2 text-[9px] text-gray-400 font-bold border-t border-dashed border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>Mínimo: {formatCurrency(goal.min_price_per_km)}/km</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-indigo-400" />
                          <span>Escala: {goal.days_per_week} dias de trabalho no período</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal History Section */}
      <div className="space-y-6 pt-10 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Histórico de Metas</h3>
          </div>
          <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-lg uppercase">Finalizadas</span>
        </div>

        {loadingGoals ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : goals.filter(g => {
          if (!g.end_date) return false;
          const end = endOfDay(new Date(g.end_date + 'T23:59:59'));
          return end < startOfDay(new Date());
        }).length === 0 ? (
          <div className="p-10 text-center bg-gray-50/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <History className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Você ainda não possui metas finalizadas no histórico.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {goals.filter(g => {
              if (!g.end_date) return false;
              const end = endOfDay(new Date(g.end_date + 'T23:59:59'));
              return end < startOfDay(new Date());
            }).map((goal) => (
              <GoalComparativeCard 
                key={goal.id} 
                goal={goal} 
                lancamentos={lancamentos} 
                onDelete={handleDeleteGoal} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalComparativeCard({ goal, lancamentos, onDelete }: { goal: CalculatorGoal; lancamentos: Lancamento[]; onDelete: (id: string) => void }) {
  // Same logic as Active Goals but for History display
  if (!goal.start_date || !goal.end_date) return null;

  const goalStart = startOfDay(new Date(goal.start_date + 'T00:00:00'));
  const goalEnd = endOfDay(new Date(goal.end_date + 'T23:59:59'));
  const vehicle = goal.vehicles;

  if (isNaN(goalStart.getTime()) || isNaN(goalEnd.getTime())) return null;

  const periodTransactions = lancamentos.filter(l => {
    if (!l.data) return false;
    try {
      const lDate = new Date(l.data + 'T12:00:00');
      return l.vehicle_id === goal.vehicle_id && 
        !isNaN(lDate.getTime()) &&
        isWithinInterval(lDate, { start: goalStart, end: goalEnd });
    } catch (e) {
      return false;
    }
  });

  const realGross = periodTransactions.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const realKM = periodTransactions.reduce((acc, l) => acc + Number(l.km_rodados || 0), 0);
  const realRevKm = realKM > 0 ? realGross / realKM : 0;
  
  const fuelCostPerKm = goal.consumption > 0 ? goal.fuel_price / goal.consumption : 0;
  const isRented = vehicle?.type === 'rented';
  const maintReservePerKm = isRented ? 0 : (vehicle?.maintenance_reserve || 0.15);
  const monthlyFixed = (isRented ? (vehicle?.contract_value || 0) : 0) + (goal.other_fixed || 0);
  const isMonthly = goal.mode === 'monthly';
  const periodFixedCost = isMonthly ? monthlyFixed : (monthlyFixed / 30) * 7;
  const realOtherExpenses = periodTransactions.filter(l => {
    if (l.tipo !== 'despesa') return false;
    const catName = l.categorias?.nome?.toLowerCase() || '';
    return !(catName.includes('combust') || catName.includes('alug') || catName.includes('rent') || catName.includes('manuten') || catName.includes('oficina'));
  }).reduce((acc, l) => acc + Number(l.valor || 0), 0);

  const realTotalCost = (realKM * fuelCostPerKm) + (realKM * maintReservePerKm) + periodFixedCost + realOtherExpenses;
  
  const metaGross = goal.total_revenue_needed;
  const metaKM = goal.km_per_day * goal.days_per_week;
  const metaRevKm = goal.min_price_per_km;
  const metaCost = metaGross - goal.profit_goal;

  const profitProgress = Math.min(100, Math.max(0, ((realGross - realTotalCost) / (goal.profit_goal || 1)) * 100));

  return (
    <Card className="border-none shadow-md bg-white dark:bg-gray-900 overflow-hidden rounded-3xl relative group opacity-90 grayscale-[0.2]">
      <CardContent className="p-0">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-3 w-3 text-gray-400" />
            <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              {vehicle?.name} • Finalizada
            </span>
          </div>
          <Button 
            variant="ghost" size="icon" onClick={() => onDelete(goal.id)}
            className="h-6 w-6 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between items-end px-1">
              <span className="text-[9px] font-black text-gray-400 uppercase">Resultado Final (Lucro)</span>
              <span className={cn("text-xs font-black", profitProgress >= 100 ? "text-emerald-500" : "text-amber-500")}>
                {profitProgress.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={cn("h-full", profitProgress >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${profitProgress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MetricComparison label="Ganho Bruto" metaValue={formatCurrency(metaGross)} realValue={formatCurrency(realGross)} isMet={realGross >= metaGross} />
            <MetricComparison label="Total KM" metaValue={`${metaKM} KM`} realValue={`${realKM} KM`} isMet={realKM >= metaKM} />
            <MetricComparison label="Eficiência" metaValue={formatCurrency(metaRevKm)} realValue={formatCurrency(realRevKm)} isMet={realRevKm >= metaRevKm} />
            <MetricComparison label="Custo Total" metaValue={formatCurrency(metaCost)} realValue={formatCurrency(realTotalCost)} isMet={realTotalCost <= metaCost} isCost />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricComparison({ label, metaValue, realValue, isMet, isCost = false, isNegative = false }: { label: string; metaValue: string; realValue: string; isMet: boolean; isCost?: boolean; isNegative?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] text-center">{label}</p>
      <div className="flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 leading-tight">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-blue-500/70 uppercase">Meta</span>
          <span className="text-sm font-black text-blue-600 dark:text-blue-400">{metaValue}</span>
        </div>
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1.5" />
        <div className="flex flex-col text-right">
          <span className="text-[8px] font-black text-gray-400 uppercase">Real</span>
          <span className={cn(
            "text-sm font-black",
            isCost || isNegative ? "text-red-500" : (isMet ? "text-emerald-500" : "text-amber-500")
          )}>
            {realValue}
          </span>
        </div>
      </div>
    </div>
  );
}
