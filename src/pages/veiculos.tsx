import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { PremiumModal } from '@/components/premium-modal';
import { formatCurrency, formatCurrencyInput, parseCurrency, isPremium, parseLocalDate } from '@/lib/utils';
import { Lancamento, Vehicle, Manutencao, User, WorkShift, FuelType } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Car, RefreshCw, Plus, ChevronDown, ChevronUp, Wrench, Lock, X, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { useFeatures } from '@/contexts/FeatureContext';

import { PremiumLockedOverlay } from '@/components/PremiumLockedOverlay';

interface VeiculosProps {
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  manutencoes: Manutencao[];
  workShifts: WorkShift[];
  refetch: () => void;
  user: User;
  onBackToConfig?: () => void;
  onBackToHome?: () => void;
  isEmbedded?: boolean;
  forceOpenAdd?: boolean;
}

export function Veiculos({ vehicles, lancamentos, manutencoes, workShifts, refetch, user, onBackToConfig, onBackToHome, isEmbedded = false, forceOpenAdd = false }: VeiculosProps) {
  const { preferences } = useFeatures();
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [type, setType] = useState<'own' | 'rented'>('own');
  const [status, setStatus] = useState<'active' | 'sold' | 'deactivated'>('active');
  const [initialOdometer, setInitialOdometer] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gasolina');
  
  // Rented specific
  const [contractValueStr, setContractValueStr] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractInitialKm, setContractInitialKm] = useState('');
  const [contractKmLimit, setContractKmLimit] = useState('');
  const [profitGoalStr, setProfitGoalStr] = useState('');
  
  // Own specific
  const [maintenanceReserveStr, setMaintenanceReserveStr] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(forceOpenAdd);

  useEffect(() => {
    if (forceOpenAdd) {
      setIsFormOpen(true);
    }
  }, [forceOpenAdd]);

  // Renew Contract specific
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewingVehicle, setRenewingVehicle] = useState<Vehicle | null>(null);
  const [renewContractValueStr, setRenewContractValueStr] = useState('');
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewInitialKm, setRenewInitialKm] = useState('');
  const [renewContractKmLimit, setRenewContractKmLimit] = useState('');
  const [addRemainingKm, setAddRemainingKm] = useState(false);
  const [renewProfitGoalStr, setRenewProfitGoalStr] = useState('');
  
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  const toggleInfo = (id: string) => {
    setExpandedInfo(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return 0;
    const end = parseLocalDate(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name || !plate || !initialOdometer) {
      setErrorMsg('Preencha os campos obrigatórios.');
      return;
    }

    if (!editingId && !isPremium(user) && vehicles.length >= 1) {
      setPremiumFeatureName('Múltiplos Veículos');
      setIsPremiumModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      if (!editingId && !isPremium(user) && vehicles.filter(v => v.status === 'active').length >= 1) {
        setPremiumFeatureName('Múltiplos Veículos Ativos');
        setIsPremiumModalOpen(true);
        setLoading(false);
        return;
      }
      const payload: any = {
        user_id: user.id,
        name,
        plate,
        type,
        status,
        initial_odometer: Number(initialOdometer),
        fuel_type: fuelType,
      };

      if (type === 'rented') {
        payload.contract_value = parseCurrency(contractValueStr);
        payload.contract_start_date = contractStartDate || null;
        payload.contract_end_date = contractEndDate || null;
        payload.contract_initial_km = contractInitialKm ? Number(contractInitialKm) : null;
        payload.contract_km_limit = contractKmLimit ? Number(contractKmLimit) : null;
        payload.profit_goal = parseCurrency(profitGoalStr);
        payload.maintenance_reserve = null;
      } else {
        payload.profit_goal = parseCurrency(profitGoalStr);
        payload.maintenance_reserve = parseCurrency(maintenanceReserveStr);
        payload.contract_value = null;
        payload.contract_start_date = null;
        payload.contract_end_date = null;
        payload.contract_initial_km = null;
        payload.contract_km_limit = null;
      }

      if (editingId) {
        console.log('Updating vehicle:', editingId, payload);
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingId);
        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
      } else {
        console.log('Inserting vehicle:', payload);
        const { data: newVehicle, error } = await supabase.from('vehicles').insert([payload]).select();
        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        if (type === 'rented') {
          const { data: catData } = await supabase.from('categorias').select('id').eq('nome', 'Aluguel').eq('user_id', user.id).single();
          if (catData) {
            await supabase.from('lancamentos').insert([{
              user_id: user.id,
              tipo: 'despesa',
              categoria_id: catData.id,
              vehicle_id: newVehicle[0].id,
              valor: parseCurrency(contractValueStr),
              data: contractStartDate || format(new Date(), 'yyyy-MM-dd'),
              observacao: `Pagamento inicial do contrato - ${name}`
            }]);
          }
        }
      }

      resetForm();
      setIsFormOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar veículo.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPlate('');
    setType('own');
    setStatus('active');
    setInitialOdometer('');
    setFuelType('gasolina');
    setContractValueStr('');
    setContractStartDate('');
    setContractEndDate('');
    setContractInitialKm('');
    setContractKmLimit('');
    setProfitGoalStr('');
    setMaintenanceReserveStr('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setIsFormOpen(true);
    setName(vehicle.name);
    setPlate(vehicle.plate);
    setType(vehicle.type);
    setStatus(vehicle.status || 'active');
    setInitialOdometer(vehicle.initial_odometer.toString());
    setFuelType(vehicle.fuel_type || 'gasolina');
    
    if (vehicle.type === 'rented') {
      setContractValueStr(formatCurrency(vehicle.contract_value || 0));
      setContractStartDate(vehicle.contract_start_date || '');
      setContractEndDate(vehicle.contract_end_date || '');
      setContractInitialKm(vehicle.contract_initial_km?.toString() || '');
      setContractKmLimit(vehicle.contract_km_limit?.toString() || '');
      setProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
      setMaintenanceReserveStr('');
    } else {
      setProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
      setMaintenanceReserveStr(formatCurrency(vehicle.maintenance_reserve || 0));
      setContractValueStr('');
      setContractStartDate('');
      setContractEndDate('');
      setContractInitialKm('');
      setContractKmLimit('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRenew = (vehicle: Vehicle) => {
    setRenewingVehicle(vehicle);
    setRenewContractValueStr(formatCurrency(vehicle.contract_value || 0));
    setRenewStartDate(vehicle.contract_end_date || ''); // Default to previous end date
    setRenewEndDate('');
    
    // Get the last known odometer to use as the new initial KM
    const metrics = calculateMetrics(vehicle);
    setRenewInitialKm(metrics.lastOdometer.toString());
    
    setRenewContractKmLimit(vehicle.contract_km_limit?.toString() || '');
    setAddRemainingKm(false);
    setRenewProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
    setRenewModalOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingVehicle) return;

    setLoading(true);
    try {
      let finalKmLimit = renewContractKmLimit ? Number(renewContractKmLimit) : null;

      if (addRemainingKm && finalKmLimit !== null) {
        const metrics = calculateMetrics(renewingVehicle);
        const kmRodadoContrato = metrics.lastOdometer - (renewingVehicle.contract_initial_km || renewingVehicle.initial_odometer);
        const kmRestante = (renewingVehicle.contract_km_limit || 0) - kmRodadoContrato;
        
        if (kmRestante > 0) {
          finalKmLimit += kmRestante;
        }
      }

      const payload = {
        contract_value: parseCurrency(renewContractValueStr),
        contract_start_date: renewStartDate || null,
        contract_end_date: renewEndDate || null,
        contract_initial_km: renewInitialKm ? Number(renewInitialKm) : null,
        contract_km_limit: finalKmLimit,
        profit_goal: parseCurrency(renewProfitGoalStr),
      };

      const { error } = await supabase.from('vehicles').update(payload).eq('id', renewingVehicle.id);
      if (error) throw error;

      const { data: catData } = await supabase.from('categorias').select('id').eq('nome', 'Aluguel').eq('user_id', user.id).single();
      if (catData) {
        await supabase.from('lancamentos').insert([{
          user_id: user.id,
          tipo: 'despesa',
          categoria_id: catData.id,
          vehicle_id: renewingVehicle.id,
          valor: parseCurrency(renewContractValueStr),
          data: renewStartDate || format(new Date(), 'yyyy-MM-dd'),
          observacao: `Pagamento de renovação de contrato - ${renewingVehicle.name}`
        }]);
      }

      setRenewModalOpen(false);
      setRenewingVehicle(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao renovar contrato.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', deletingId);
      if (error) throw error;
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir veículo.');
    }
  };

  const calculateMetrics = (vehicle: Vehicle) => {
    const vLancamentos = lancamentos.filter(l => l.vehicle_id === vehicle.id);
    
    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalCombustivel = 0;
    let maxOdometer = vehicle.initial_odometer;

    // Identify contracts for rented vehicles
    const contracts: {
      id: string;
      name: string;
      start_date: string;
      end_date: string | null;
      start_lancamento_id: string;
      receitas: number;
      despesas: number;
      saldo: number;
    }[] = [];

    if (vehicle.type === 'rented') {
      const contractStarts = vLancamentos
        .filter(l => l.observacao && (l.observacao.startsWith('Pagamento inicial do contrato') || l.observacao.startsWith('Pagamento de renovação de contrato')))
        .sort((a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime());

      contractStarts.forEach((startL, index) => {
        const nextStart = contractStarts[index + 1];
        contracts.push({
          id: startL.id,
          name: index === 0 ? '1º Contrato' : `${index + 1}º Contrato`,
          start_date: startL.data,
          end_date: nextStart ? nextStart.data : vehicle.contract_end_date || null,
          start_lancamento_id: startL.id,
          receitas: 0,
          despesas: 0,
          saldo: 0
        });
      });
    }

    vLancamentos.forEach(l => {
      const valor = Number(l.valor);
      if (l.tipo === 'receita') {
        totalReceitas += valor;
      } else {
        totalDespesas += valor;
        
        if (l.odometer && l.odometer > maxOdometer) {
          maxOdometer = l.odometer;
        }

        if (l.fuel_liters && l.fuel_liters > 0) {
          totalCombustivel += valor;
        }
      }

      // Assign to contract if rented
      if (vehicle.type === 'rented' && contracts.length > 0) {
        // First check if it's a start lancamento for any contract (prioritize the contract it starts)
        const startContract = contracts.find(c => c.start_lancamento_id === l.id);
        if (startContract) {
          if (l.tipo === 'receita') startContract.receitas += valor;
          else startContract.despesas += valor;
        } else {
          // Date based assignment for other lancamentos
          for (let i = 0; i < contracts.length; i++) {
            const c = contracts[i];
            const isLast = i === contracts.length - 1;
            
            if (i === 0) {
              if (isLast || !c.end_date || l.data <= c.end_date) {
                if (l.tipo === 'receita') c.receitas += valor;
                else c.despesas += valor;
                break;
              }
            } else {
              if (l.data > c.start_date && (isLast || !c.end_date || l.data <= c.end_date)) {
                if (l.tipo === 'receita') c.receitas += valor;
                else c.despesas += valor;
                break;
              }
            }
          }
        }
      }
    });

    contracts.forEach(c => {
      c.saldo = c.receitas - c.despesas;
    });

    let totalLitros = 0;
    let kmRodadoCombustivel = 0;
    const consumptionByFuelType: Record<string, { litros: number, km: number }> = {};

    const sortedFuelEntries = vLancamentos
      .filter(l => l.tipo === 'despesa' && l.fuel_liters && l.fuel_liters > 0 && l.odometer)
      .sort((a, b) => a.odometer! - b.odometer!);

    sortedFuelEntries.forEach((entry, index) => {
      const consumedFuelType = index > 0 ? (sortedFuelEntries[index - 1].fuel_type || 'unknown') : (entry.fuel_type || 'unknown');
      
      if (!consumptionByFuelType[consumedFuelType]) {
        consumptionByFuelType[consumedFuelType] = { litros: 0, km: 0 };
      }
      
      const litros = Number(entry.fuel_liters);
      totalLitros += litros;
      consumptionByFuelType[consumedFuelType].litros += litros;

      const prevOdometer = index > 0 ? sortedFuelEntries[index - 1].odometer! : (vehicle.initial_odometer || 0);
      const distance = entry.odometer! - prevOdometer;
      
      if (distance > 0) {
        kmRodadoCombustivel += distance;
        consumptionByFuelType[consumedFuelType].km += distance;
      }
    });

    const lucroLiquido = totalReceitas - totalDespesas;
    const kmRodadoTotal = maxOdometer - vehicle.initial_odometer;
    
    // Nova lógica de média de consumo (últimos 3 tanques cheios)
    let mediaKmL = '0.00';
    const fullTanks = sortedFuelEntries.filter(l => l.is_full_tank);
    
    if (fullTanks.length >= 2) {
      // Pegar até os últimos 4 tanques cheios (o que nos dá até 3 ciclos completos)
      const recentFullTanks = fullTanks.slice(-4);
      const startFullTank = recentFullTanks[0];
      const endFullTank = recentFullTanks[recentFullTanks.length - 1];
      
      const distance = endFullTank.odometer! - startFullTank.odometer!;
      
      // Somar os litros de todos os abastecimentos (cheios ou parciais) DEPOIS do tanque inicial até o tanque final
      const entriesInCycle = sortedFuelEntries.filter(l => l.odometer! > startFullTank.odometer! && l.odometer! <= endFullTank.odometer!);
      const litersInCycle = entriesInCycle.reduce((acc, l) => acc + (l.fuel_liters || 0), 0);
      
      if (litersInCycle > 0 && distance > 0) {
        mediaKmL = (distance / litersInCycle).toFixed(2);
      }
    } else {
      // Fallback para a lógica antiga se não houver tanques cheios suficientes
      mediaKmL = totalLitros > 0 ? (kmRodadoCombustivel / totalLitros).toFixed(2) : '0.00';
    }

    const vehicleShifts = workShifts.filter(s => s.vehicle_id === vehicle.id && s.type === 'work');
    let vMinutes = 0;
    let vOdometer = 0;
    const vWorkDates = new Set(vehicleShifts.map(s => s.date));

    vehicleShifts.forEach(s => {
      if (s.start_time && s.end_time) {
        const [startH, startM] = s.start_time.split(':').map(Number);
        const [endH, endM] = s.end_time.split(':').map(Number);
        let minutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (minutes < 0) minutes += 24 * 60;
        vMinutes += minutes;
      }
      if (s.odometer) {
        vOdometer += Number(s.odometer);
      }
    });

    let vReceitasTurno = 0;
    let vDespesasTurno = 0;
    let totalLiters = 0;
    let totalFuelCost = 0;

    vLancamentos.forEach(l => {
      const lDateFormatted = format(parseLocalDate(l.data), 'yyyy-MM-dd');
      
      if (vWorkDates.has(lDateFormatted)) {
        if (l.tipo === 'receita') vReceitasTurno += Number(l.valor);
        if (l.tipo === 'despesa') vDespesasTurno += Number(l.valor);
      }

      if (l.tipo === 'despesa' && l.fuel_liters && l.valor) {
        totalLiters += Number(l.fuel_liters);
        totalFuelCost += Number(l.valor);
      }
    });

    const vHours = vMinutes / 60;
    const vGanhoHora = vHours > 0 ? vReceitasTurno / vHours : 0;
    const averageFuelPrice = totalLiters > 0 ? totalFuelCost / totalLiters : 5.50;
    const averageKmL = Number(mediaKmL) > 0 ? Number(mediaKmL) : 10;
    const estimatedFuelCost = (vOdometer / averageKmL) * averageFuelPrice;

    return {
      totalReceitas,
      totalDespesas,
      lucroLiquido,
      totalCombustivel,
      mediaKmL,
      consumptionByFuelType,
      kmRodado: kmRodadoTotal,
      lastOdometer: maxOdometer,
      contracts,
      shiftHours: vHours,
      shiftOdometer: vOdometer,
      shiftGanhoHora: vGanhoHora,
      shiftEstimatedFuelCost: estimatedFuelCost
    };
  };

  const sortedVehicles = [...vehicles].sort((a, b) => {
    const getOrder = (v: Vehicle) => {
      if (v.status === 'sold' || v.status === 'deactivated') return 3;
      if (v.type === 'own') return 1;
      if (v.type === 'rented') return 2;
      return 4;
    };
    return getOrder(a) - getOrder(b);
  });

  return (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex items-center justify-between -mb-2 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm sm:shadow-none sm:bg-transparent">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBackToConfig}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meus Veículos</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBackToHome}
            className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      )}

      {vehicles.length === 0 && (
        <OnboardingGuide
          step="vehicle"
          title="Cadastre seu primeiro veículo"
          description="Para começar a controlar seus gastos, adicione o carro ou moto que você utiliza."
          onClick={() => setIsFormOpen(true)}
          buttonText="Adicionar Veículo"
        />
      )}

      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-gray-900">
        <div 
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          onClick={() => {
            if (!isFormOpen && !editingId && !isPremium(user) && vehicles.length >= 1) {
              setPremiumFeatureName('Cadastro de Múltiplos Veículos');
              setIsPremiumModalOpen(true);
              return;
            }
            setIsFormOpen(true);
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F59E0B]/10 rounded-lg">
              {!isPremium(user) && vehicles.length >= 1 ? (
                <Lock className="h-5 w-5 text-amber-500" />
              ) : (
                <Car className="h-5 w-5 text-[#F59E0B]" />
              )}
            </div>
            <div className="hidden sm:block">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {editingId ? 'Editar Veículo' : 'Novo Veículo'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isFormOpen ? 'Preencha os dados abaixo' : 'Clique para cadastrar um novo veículo'}
              </p>
            </div>
            <div className="sm:hidden">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {editingId ? 'Editar Veículo' : 'Cadastrar veículo'}
              </h3>
            </div>
          </div>
          <div className="text-[#F59E0B] sm:hidden">
            {isFormOpen ? <ChevronUp className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex text-[#F59E0B] hover:text-[#D97706] hover:bg-[#F59E0B]/5 dark:hover:bg-[#F59E0B]/10"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Cadastrar Veículo</span>
            </div>
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          resetForm();
          setErrorMsg('');
        }}
        title={editingId ? 'Editar Veículo' : 'Novo Veículo'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Veículo *</label>
                  <Input
                    type="text"
                    placeholder="Ex: Corolla 2015"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Placa *</label>
                  <Input
                    type="text"
                    placeholder="ABC-1234"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo *</label>
                  <CustomSelect 
                    value={type} 
                    onChange={(val) => {
                      const newType = val as 'own' | 'rented';
                      setType(newType);
                      if (newType === 'own' && status === 'deactivated') setStatus('active');
                      if (newType === 'rented' && status === 'sold') setStatus('active');
                    }}
                    options={[
                      { value: 'own', label: 'Próprio' },
                      { value: 'rented', label: 'Alugado' }
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status *</label>
                  <CustomSelect 
                    value={status} 
                    onChange={(val) => setStatus(val as any)}
                    options={[
                      { value: 'active', label: 'Ativo' },
                      ...(type === 'own' ? [{ value: 'sold', label: 'Vendido' }] : [{ value: 'deactivated', label: 'Desativado' }])
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Odômetro Inicial (KM) *</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 50000"
                    value={initialOdometer}
                    onChange={(e) => setInitialOdometer(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Combustível *</label>
                  <CustomSelect 
                    value={fuelType} 
                    onChange={(val) => setFuelType(val as FuelType)}
                    options={[
                      { value: 'gasolina', label: 'Gasolina' },
                      { value: 'etanol', label: 'Álcool / Etanol' },
                      { value: 'diesel', label: 'Diesel' },
                      { value: 'flex', label: 'Flex (Gasolina/Álcool)' },
                      { value: 'gnv', label: 'GNV' }
                    ]}
                  />
                </div>
              </div>

              {type === 'rented' ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor do Contrato</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={contractValueStr}
                      onChange={(e) => setContractValueStr(formatCurrencyInput(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta de Lucro</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={profitGoalStr}
                      onChange={(e) => setProfitGoalStr(formatCurrencyInput(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Início Contrato</label>
                    <Input
                      type="date"
                      value={contractStartDate}
                      onChange={(e) => setContractStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Fim Contrato</label>
                    <Input
                      type="date"
                      value={contractEndDate}
                      onChange={(e) => setContractEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KM Inicial Contrato</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ex: 50000"
                      value={contractInitialKm}
                      onChange={(e) => setContractInitialKm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Franquia de KM (Limite)</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ex: 5000"
                      value={contractKmLimit}
                      onChange={(e) => setContractKmLimit(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reserva de Manutenção</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={maintenanceReserveStr}
                      onChange={(e) => setMaintenanceReserveStr(formatCurrencyInput(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta de Lucro</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={profitGoalStr}
                      onChange={(e) => setProfitGoalStr(formatCurrencyInput(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706] text-white">
                  {loading ? 'Salvando...' : editingId ? 'Atualizar Veículo' : 'Salvar Veículo'}
                </Button>
              </div>
            </form>
      </Modal>

      <div className="flex flex-col gap-4">
        {sortedVehicles.map((v) => {
          const metrics = calculateMetrics(v);
          return (
            <Card key={v.id} className={`overflow-hidden transition-all duration-200 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 ${v.status !== 'active' ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-md'}`}>
              <div 
                className="bg-white dark:bg-gray-900 px-4 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => toggleInfo(v.id)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-xl shadow-sm border ${v.status === 'sold' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : v.status === 'deactivated' ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
                    <Car className={`h-5 w-5 sm:h-6 sm:w-6 ${v.status === 'sold' ? 'text-red-500 dark:text-red-400' : v.status === 'deactivated' ? 'text-gray-500 dark:text-gray-400' : 'text-[#F59E0B]'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{v.name}</h3>
                      {expandedInfo[v.id] ? (
                        <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md uppercase tracking-wider">{v.plate}</span>
                      <span className={`px-2 py-1 rounded-md uppercase tracking-wider ${v.type === 'own' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'}`}>
                        {v.type === 'own' ? 'Próprio' : 'Alugado'}
                      </span>
                      {v.status === 'sold' && <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-md uppercase tracking-wider">Vendido</span>}
                      {v.status === 'deactivated' && <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md uppercase tracking-wider">Desativado</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                  {v.type === 'rented' && (
                    <Button variant="outline" size="icon" onClick={() => handleOpenRenew(v)} className="text-[#059568] border-[#059568]/20 hover:bg-[#059568]/10 dark:text-[#10B981] dark:border-[#10B981]/20 dark:hover:bg-[#10B981]/10" title="Renovar Contrato">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => handleEdit(v)} className="text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/10 dark:text-[#FBBF24] dark:border-[#FBBF24]/20 dark:hover:bg-[#FBBF24]/10" title="Editar">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => confirmDelete(v.id)} className="text-red-500 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {expandedInfo[v.id] && (
                <CardContent className="p-6 animate-in fade-in slide-in-from-top-2 duration-200 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800">
                  {/* Section: Financeiro */}
                  <div className="mb-8">
                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#059568] dark:bg-[#10B981]"></span>
                      Financeiro
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Saldo</p>
                        <p className={`font-bold text-2xl ${metrics.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`}>
                          {formatCurrency(metrics.lucroLiquido)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Receitas</p>
                        <p className="font-semibold text-xl text-[#059568] dark:text-[#10B981]">{formatCurrency(metrics.totalReceitas)}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Despesas</p>
                        <p className="font-semibold text-xl text-[#EF4444] dark:text-[#F87171]">{formatCurrency(metrics.totalDespesas)}</p>
                      </div>
                    </div>
                  </div>

          {/* Section: Histórico de Contratos */}
          {v.type === 'rented' && metrics.contracts && metrics.contracts.length > 0 && (
            <div className="mb-8">
              <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></span>
                Histórico de Contratos
              </h4>
              <div className="space-y-3">
                {metrics.contracts.map((contract, idx) => (
                  <div key={contract.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{contract.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {contract.start_date.split('-').reverse().join('/')} até {contract.end_date ? contract.end_date.split('-').reverse().join('/') : 'Atual'}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Receitas</p>
                        <p className="font-semibold text-sm text-[#059568] dark:text-[#10B981]">{formatCurrency(contract.receitas)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Despesas</p>
                        <p className="font-semibold text-sm text-[#EF4444] dark:text-[#F87171]">{formatCurrency(contract.despesas)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Saldo</p>
                        <p className={`font-bold text-sm ${contract.saldo >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`}>
                          {formatCurrency(contract.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

                  {/* Section: Turnos e Desempenho */}
                  <PremiumLockedOverlay
                    user={user}
                    onUnlock={() => { setPremiumFeatureName('Desempenho em Turnos'); setIsPremiumModalOpen(true); }}
                  >
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></span>
                        Desempenho em Turnos (Trabalho)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                          <p className="text-xs font-medium text-indigo-600/80 dark:text-indigo-400/80 mb-1">Horas Trabalhadas</p>
                          <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300">
                            {Math.floor(metrics.shiftHours)}h {Math.round((metrics.shiftHours % 1) * 60)}m
                          </p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                          <p className="text-xs font-medium text-indigo-600/80 dark:text-indigo-400/80 mb-1">Ganho por Hora</p>
                          <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300">
                            {formatCurrency(metrics.shiftGanhoHora)}/h
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">KM em Turnos</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{metrics.shiftOdometer.toFixed(2)} km</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Custo Combustível Estimado</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(metrics.shiftEstimatedFuelCost)}</p>
                        </div>
                      </div>
                    </div>
                  </PremiumLockedOverlay>

                  {/* Section: Contrato */}
                  {v.type === 'rented' && (
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                        Contrato de Aluguel
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                          <p className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80 mb-1">Dias Restantes</p>
                          <p className="font-bold text-lg text-blue-700 dark:text-blue-300">{getDaysRemaining(v.contract_end_date)} dias</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                          <p className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80 mb-1">KM Restante</p>
                          <p className="font-bold text-lg text-blue-700 dark:text-blue-300">
                            {v.contract_km_limit ? (v.contract_km_limit - (metrics.lastOdometer - (v.contract_initial_km || v.initial_odometer))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'} km
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Franquia de KM</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{v.contract_km_limit ? v.contract_km_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'} km</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">KM Inicial Contrato</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{v.contract_initial_km ? v.contract_initial_km.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section: Uso e Consumo */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400"></span>
                      Uso e Consumo
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Último Odômetro</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{metrics.lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">KM Rodado</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{metrics.kmRodado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Média Consumo</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{metrics.mediaKmL} km/l</p>
                        {Object.entries(metrics.consumptionByFuelType).map(([type, data]) => {
                          if (data.litros > 0 && data.km > 0 && type !== 'unknown') {
                            const avg = (data.km / data.litros).toFixed(2);
                            return (
                              <p key={type} className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 capitalize">
                                {type}: {avg} km/l
                              </p>
                            );
                          }
                          return null;
                        })}
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Gasto Combustível</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(metrics.totalCombustivel)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        
        {vehicles.length === 0 && (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-xl border border-dashed dark:border-gray-800">
            Nenhum veículo cadastrado ainda.
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Tem certeza que deseja excluir este veículo? Os lançamentos atrelados a ele não serão apagados, apenas perderão o vínculo.
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
        isOpen={renewModalOpen}
        onClose={() => {
          setRenewModalOpen(false);
          setErrorMsg('');
        }}
        title={`Renovar Contrato - ${renewingVehicle?.name}`}
        className="max-w-lg"
      >
        <form onSubmit={handleRenewSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo Valor do Contrato</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={renewContractValueStr}
                onChange={(e) => setRenewContractValueStr(formatCurrencyInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Meta de Lucro</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={renewProfitGoalStr}
                onChange={(e) => setRenewProfitGoalStr(formatCurrencyInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Data Início</label>
              <Input
                type="date"
                value={renewStartDate}
                onChange={(e) => setRenewStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Data Fim</label>
              <Input
                type="date"
                value={renewEndDate}
                onChange={(e) => setRenewEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo KM Inicial do Contrato</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 50000"
                value={renewInitialKm}
                onChange={(e) => setRenewInitialKm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Franquia de KM (Limite)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 5000"
                value={renewContractKmLimit}
                onChange={(e) => setRenewContractKmLimit(e.target.value)}
              />
            </div>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">O KM inicial foi preenchido automaticamente com o último odômetro registrado.</p>
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="addRemainingKm"
              checked={addRemainingKm}
              onChange={(e) => setAddRemainingKm(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-[#F59E0B] focus:ring-[#F59E0B] dark:bg-gray-700"
            />
            <label htmlFor="addRemainingKm" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Somar KM restante do contrato anterior ao novo contrato?
            </label>
          </div>
          <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setRenewModalOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706] text-white">
              {loading ? 'Salvando...' : 'Confirmar Renovação'}
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
