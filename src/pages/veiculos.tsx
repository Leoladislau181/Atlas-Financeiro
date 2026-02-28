import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatCurrencyInput, parseCurrency } from '@/lib/utils';
import { Lancamento, Vehicle } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Car, RefreshCw } from 'lucide-react';

interface VeiculosProps {
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  refetch: () => void;
  userId: string;
}

export function Veiculos({ vehicles, lancamentos, refetch, userId }: VeiculosProps) {
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [type, setType] = useState<'own' | 'rented'>('own');
  const [initialOdometer, setInitialOdometer] = useState('');
  
  // Rented specific
  const [contractValueStr, setContractValueStr] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractInitialKm, setContractInitialKm] = useState('');
  const [profitGoalStr, setProfitGoalStr] = useState('');
  
  // Own specific
  const [maintenanceReserveStr, setMaintenanceReserveStr] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Renew Contract specific
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewingVehicle, setRenewingVehicle] = useState<Vehicle | null>(null);
  const [renewContractValueStr, setRenewContractValueStr] = useState('');
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewInitialKm, setRenewInitialKm] = useState('');
  const [renewProfitGoalStr, setRenewProfitGoalStr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !plate || !initialOdometer) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        user_id: userId,
        name,
        plate,
        type,
        initial_odometer: Number(initialOdometer),
      };

      if (type === 'rented') {
        payload.contract_value = parseCurrency(contractValueStr);
        payload.contract_start_date = contractStartDate || null;
        payload.contract_end_date = contractEndDate || null;
        payload.contract_initial_km = contractInitialKm ? Number(contractInitialKm) : null;
        payload.profit_goal = parseCurrency(profitGoalStr);
        payload.maintenance_reserve = null;
      } else {
        payload.profit_goal = parseCurrency(profitGoalStr);
        payload.maintenance_reserve = parseCurrency(maintenanceReserveStr);
        payload.contract_value = null;
        payload.contract_start_date = null;
        payload.contract_end_date = null;
        payload.contract_initial_km = null;
      }

      if (editingId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicles').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar veículo.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPlate('');
    setType('own');
    setInitialOdometer('');
    setContractValueStr('');
    setContractStartDate('');
    setContractEndDate('');
    setContractInitialKm('');
    setProfitGoalStr('');
    setMaintenanceReserveStr('');
    setEditingId(null);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setName(vehicle.name);
    setPlate(vehicle.plate);
    setType(vehicle.type);
    setInitialOdometer(vehicle.initial_odometer.toString());
    
    if (vehicle.type === 'rented') {
      setContractValueStr(formatCurrency(vehicle.contract_value || 0));
      setContractStartDate(vehicle.contract_start_date || '');
      setContractEndDate(vehicle.contract_end_date || '');
      setContractInitialKm(vehicle.contract_initial_km?.toString() || '');
      setProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
      setMaintenanceReserveStr('');
    } else {
      setProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
      setMaintenanceReserveStr(formatCurrency(vehicle.maintenance_reserve || 0));
      setContractValueStr('');
      setContractStartDate('');
      setContractEndDate('');
      setContractInitialKm('');
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
    
    setRenewProfitGoalStr(formatCurrency(vehicle.profit_goal || 0));
    setRenewModalOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingVehicle) return;

    setLoading(true);
    try {
      const payload = {
        contract_value: parseCurrency(renewContractValueStr),
        contract_start_date: renewStartDate || null,
        contract_end_date: renewEndDate || null,
        contract_initial_km: renewInitialKm ? Number(renewInitialKm) : null,
        profit_goal: parseCurrency(renewProfitGoalStr),
      };

      const { error } = await supabase.from('vehicles').update(payload).eq('id', renewingVehicle.id);
      if (error) throw error;

      setRenewModalOpen(false);
      setRenewingVehicle(null);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao renovar contrato.');
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
      alert(error.message || 'Erro ao excluir veículo.');
    }
  };

  const calculateMetrics = (vehicle: Vehicle) => {
    const vLancamentos = lancamentos.filter(l => l.vehicle_id === vehicle.id);
    
    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalCombustivel = 0;
    let totalLitros = 0;
    let maxOdometer = vehicle.initial_odometer;
    let maxFuelOdometer = vehicle.initial_odometer;

    vLancamentos.forEach(l => {
      if (l.tipo === 'receita') {
        totalReceitas += Number(l.valor);
      } else {
        totalDespesas += Number(l.valor);
        
        if (l.odometer && l.odometer > maxOdometer) {
          maxOdometer = l.odometer;
        }

        if (l.fuel_liters && l.fuel_liters > 0) {
          totalCombustivel += Number(l.valor);
          totalLitros += Number(l.fuel_liters);
          if (l.odometer && l.odometer > maxFuelOdometer) {
            maxFuelOdometer = l.odometer;
          }
        }
      }
    });

    const lucroLiquido = totalReceitas - totalDespesas;
    const kmRodadoTotal = maxOdometer - vehicle.initial_odometer;
    const kmRodadoCombustivel = maxFuelOdometer - vehicle.initial_odometer;
    const mediaKmL = totalLitros > 0 ? (kmRodadoCombustivel / totalLitros).toFixed(2) : '0.00';

    return {
      totalReceitas,
      totalDespesas,
      lucroLiquido,
      totalCombustivel,
      mediaKmL,
      kmRodado: kmRodadoTotal,
      lastOdometer: maxOdometer
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar Veículo' : 'Novo Veículo'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nome do Veículo *</label>
                <Input
                  type="text"
                  placeholder="Ex: Corolla 2015"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Placa *</label>
                <Input
                  type="text"
                  placeholder="ABC-1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo *</label>
                <Select value={type} onChange={(e) => setType(e.target.value as 'own' | 'rented')}>
                  <option value="own">Próprio</option>
                  <option value="rented">Alugado</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Odômetro Inicial (KM) *</label>
                <Input
                  type="number"
                  placeholder="Ex: 50000"
                  value={initialOdometer}
                  onChange={(e) => setInitialOdometer(e.target.value)}
                  required
                />
              </div>
            </div>

            {type === 'rented' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Valor do Contrato</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={contractValueStr}
                    onChange={(e) => setContractValueStr(formatCurrencyInput(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Meta de Lucro</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={profitGoalStr}
                    onChange={(e) => setProfitGoalStr(formatCurrencyInput(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Data Início Contrato</label>
                  <Input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Data Fim Contrato</label>
                  <Input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">KM Inicial Contrato</label>
                  <Input
                    type="number"
                    placeholder="Ex: 50000"
                    value={contractInitialKm}
                    onChange={(e) => setContractInitialKm(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Meta de Lucro Mensal</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={profitGoalStr}
                    onChange={(e) => setProfitGoalStr(formatCurrencyInput(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Reserva Manutenção Mensal</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={maintenanceReserveStr}
                    onChange={(e) => setMaintenanceReserveStr(formatCurrencyInput(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-2"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : editingId ? 'Atualizar Veículo' : 'Salvar Veículo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v) => {
          const metrics = calculateMetrics(v);
          return (
            <Card key={v.id} className="overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Car className="h-5 w-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{v.name}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{v.plate} • {v.type === 'own' ? 'Próprio' : 'Alugado'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {v.type === 'rented' && (
                    <button onClick={() => handleOpenRenew(v)} className="text-gray-400 hover:text-[#059568]" title="Renovar Contrato">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(v)} className="text-gray-400 hover:text-[#F59E0B]" title="Editar">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => confirmDelete(v.id)} className="text-gray-400 hover:text-red-500" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x divide-y border-b">
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Receitas</p>
                    <p className="font-semibold text-[#059568]">{formatCurrency(metrics.totalReceitas)}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Despesas</p>
                    <p className="font-semibold text-[#EF4444]">{formatCurrency(metrics.totalDespesas)}</p>
                  </div>
                  <div className="p-4 col-span-2 bg-gray-50/50">
                    <p className="text-xs text-gray-500 mb-1">Lucro Líquido</p>
                    <p className={`font-bold text-lg ${metrics.lucroLiquido >= 0 ? 'text-[#059568]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(metrics.lucroLiquido)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Combustível</p>
                    <p className="font-medium text-gray-900">{formatCurrency(metrics.totalCombustivel)}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Média Consumo</p>
                    <p className="font-medium text-gray-900">{metrics.mediaKmL} <span className="text-xs text-gray-500">km/l</span></p>
                  </div>
                  <div className="p-4 border-t">
                    <p className="text-xs text-gray-500 mb-1">KM Rodado</p>
                    <p className="font-medium text-gray-900">{metrics.kmRodado.toLocaleString('pt-BR')} <span className="text-xs text-gray-500">km</span></p>
                  </div>
                  <div className="p-4 border-t">
                    <p className="text-xs text-gray-500 mb-1">Último Odômetro</p>
                    <p className="font-medium text-gray-900">{metrics.lastOdometer.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {vehicles.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed">
            Nenhum veículo cadastrado ainda.
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600">
          Tem certeza que deseja excluir este veículo? Os lançamentos atrelados a ele não serão apagados, apenas perderão o vínculo.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Confirmar Exclusão
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title={`Renovar Contrato - ${renewingVehicle?.name}`}
      >
        <form onSubmit={handleRenewSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Novo Valor do Contrato</label>
            <Input
              type="text"
              placeholder="R$ 0,00"
              value={renewContractValueStr}
              onChange={(e) => setRenewContractValueStr(formatCurrencyInput(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nova Meta de Lucro</label>
            <Input
              type="text"
              placeholder="R$ 0,00"
              value={renewProfitGoalStr}
              onChange={(e) => setRenewProfitGoalStr(formatCurrencyInput(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nova Data Início</label>
              <Input
                type="date"
                value={renewStartDate}
                onChange={(e) => setRenewStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nova Data Fim</label>
              <Input
                type="date"
                value={renewEndDate}
                onChange={(e) => setRenewEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Novo KM Inicial do Contrato</label>
            <Input
              type="number"
              placeholder="Ex: 50000"
              value={renewInitialKm}
              onChange={(e) => setRenewInitialKm(e.target.value)}
            />
            <p className="text-xs text-gray-500">O KM inicial foi preenchido automaticamente com o último odômetro registrado.</p>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setRenewModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Confirmar Renovação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
