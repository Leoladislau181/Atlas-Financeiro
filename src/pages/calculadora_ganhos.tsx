import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Vehicle, Lancamento, User, CalculatorGoal } from '@/types';
import { Calculator, ChevronLeft, X, DollarSign, Target, TrendingUp, CheckCircle2, Trash2, Calendar as CalendarIcon, History, ArrowRight, Wallet, Fuel } from 'lucide-react';
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
          <div className="flex flex-col gap-4">
            {goals.filter(g => {
              if (!g.end_date) return true;
              const end = endOfDay(new Date(g.end_date + 'T23:59:59'));
              return end >= startOfDay(new Date());
            }).map((goal) => {
              // Safety check for dates to prevent crashes
              if (!goal.start_date || !goal.end_date) return null;

              const goalStart = startOfDay(new Date(goal.start_date + 'T00:00:00'));
              const goalEnd = endOfDay(new Date(goal.end_date + 'T23:59:59'));

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

              const revenue = periodTransactions
                .filter(l => l.tipo === 'receita')
                .reduce((acc, l) => acc + Number(l.valor || 0), 0);
              
              const expenses = periodTransactions
                .filter(l => l.tipo === 'despesa')
                .reduce((acc, l) => acc + Number(l.valor || 0), 0);

              const actualProfit = revenue - expenses;
              const profitGoal = goal.profit_goal || 1; // Prevent division by zero
              const progressPercentage = Math.min(100, Math.max(0, (actualProfit / profitGoal) * 100));

              return (
                <Card key={goal.id} className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden rounded-3xl relative group">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                          <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-gray-100">
                            Meta {goal.mode === 'weekly' ? 'Semanal' : 'Mensal'} • {goal.vehicles?.name || 'Veículo'}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            Vigência: {format(goalStart, "dd/MM")} até {format(goalEnd, "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Bar Section */}
                    <div className="mb-6 space-y-2">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase mb-0.5">Progresso do Lucro Líquido</p>
                          <p className="text-sm font-black text-gray-900 dark:text-gray-100">
                            {formatCurrency(actualProfit)} <span className="text-gray-400 font-medium tracking-normal">de {formatCurrency(goal.profit_goal)}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "text-lg font-black",
                            progressPercentage >= 100 ? "text-emerald-500" : "text-indigo-600"
                          )}>
                            {progressPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${progressPercentage}%`, transition: 'width 1s ease-out' }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      progressPercentage >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                    )}
                  />
                </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/30">
                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Mínimo por KM</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(goal.min_price_per_km)}
                        </p>
                      </div>
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/30">
                        <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Ganhos/Dia</p>
                        <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                          {formatCurrency(goal.daily_gross_target)}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100/30">
                        <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Rec. Necessária</p>
                        <p className="text-xl font-black text-gray-700 dark:text-gray-200">
                          {formatCurrency(goal.total_revenue_needed)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-gray-500 dark:text-gray-400 pt-3 border-t border-dashed border-gray-200 dark:border-gray-800">
                      <div className="flex gap-1.5">
                        <span className="font-bold text-gray-400">ESCALA:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {goal.days_per_week} dias/sem • {goal.km_per_day} KM/dia
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="font-bold text-gray-400">ESTIMATIVA KM:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {(goal.km_per_day * goal.days_per_week * (goal.mode === 'weekly' ? 1 : 4)).toLocaleString()} KM total
                        </span>
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
  // Safety check for dates
  if (!goal.start_date || !goal.end_date) return null;

  const goalStart = startOfDay(new Date(goal.start_date + 'T00:00:00'));
  const goalEnd = endOfDay(new Date(goal.end_date + 'T23:59:59'));

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

  const revenue = periodTransactions
    .filter(l => l.tipo === 'receita')
    .reduce((acc, l) => acc + Number(l.valor || 0), 0);
  
  const expenses = periodTransactions
    .filter(l => l.tipo === 'despesa')
    .reduce((acc, l) => acc + Number(l.valor || 0), 0);

  const actualProfit = revenue - expenses;
  const isGoalMet = actualProfit >= goal.profit_goal;
  
  return (
    <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden rounded-3xl group relative">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Left Side: Target Information */}
          <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-dashed border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-black text-gray-500 rounded-full uppercase tracking-wider">Esperado</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{format(goalStart, "dd/MM")} - {format(goalEnd, "dd/MM")}</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta de Lucro</p>
                <p className="text-xl font-black text-gray-700 dark:text-gray-200">{formatCurrency(goal.profit_goal)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Wallet className="h-2.5 w-2.5" /> Receita Req.
                  </p>
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{formatCurrency(goal.total_revenue_needed)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" /> Ganhos/Dia
                  </p>
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{formatCurrency(goal.daily_gross_target)}</p>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 font-semibold italic">
                {goal.mode === 'weekly' ? 'Projetado para 1 semana' : 'Projetado para 1 mês'} • {goal.vehicles?.name}
              </div>
            </div>
          </div>

          {/* Center Arrow (Desktop Only) */}
          <div className="hidden md:flex items-center justify-center -mx-4 z-10">
            <div className="bg-white dark:bg-gray-900 p-2 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm text-indigo-500">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Right Side: Actual Results */}
          <div className={cn(
            "flex-1 p-5 transition-colors",
            isGoalMet ? "bg-emerald-50/20 dark:bg-emerald-900/10" : "bg-red-50/20 dark:bg-red-900/10"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider",
                  isGoalMet ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  Alcançado
                </span>
                {isGoalMet ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <div className="h-3.5 w-3.5 text-red-500 flex items-center justify-center font-black text-xs">!</div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onDelete(goal.id)}
                className="h-7 w-7 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={cn(
                  "text-[9px] font-black uppercase tracking-widest mb-1",
                  isGoalMet ? "text-emerald-600/70" : "text-red-600/70"
                )}>Lucro Líquido Real</p>
                <p className={cn(
                  "text-xl font-black",
                  isGoalMet ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                )}>
                  {formatCurrency(actualProfit)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-500" /> Total Receita
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatCurrency(revenue)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Fuel className="h-2.5 w-2.5 text-red-500" /> Total Despesas
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatCurrency(expenses)}</p>
                </div>
              </div>

              <div className="pt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      isGoalMet ? "bg-emerald-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(100, (actualProfit / (goal.profit_goal || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] font-black text-gray-400">DESEMPENHO</span>
                  <span className={cn(
                    "text-[8px] font-black",
                    isGoalMet ? "text-emerald-600" : "text-red-600"
                  )}>
                    {((actualProfit / (goal.profit_goal || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
