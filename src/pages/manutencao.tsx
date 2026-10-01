import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { PremiumModal } from '@/components/premium-modal';
import { Vehicle, Manutencao, User, Lancamento } from '@/types';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit2, Trash2, Wrench, AlertTriangle, CheckCircle, Car, X } from 'lucide-react';
import { isPremium, getMostUsedVehicleId, parseLocalDate } from '@/lib/utils';
import { useFeatures } from '@/contexts/FeatureContext';

interface ManutencaoPageProps {
  vehicles: Vehicle[];
  manutencoes: Manutencao[];
  lancamentos: Lancamento[];
  user: User;
  refetch: () => void;
  onBackToConfig?: () => void;
  onBackToHome?: () => void;
  isEmbedded?: boolean;
}

export function ManutencaoPage({ vehicles, manutencoes, lancamentos, user, refetch, onBackToConfig, onBackToHome, isEmbedded = false }: ManutencaoPageProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [tipo, setTipo] = useState('');
  const [intervaloKm, setIntervaloKm] = useState('');
  const [ultimoKm, setUltimoKm] = useState('');
  const [avisoKm, setAvisoKm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  const mostUsedVehicleId = getMostUsedVehicleId(vehicles, lancamentos);

  const resetForm = () => {
    setEditingId(null);
    setVehicleId(mostUsedVehicleId || (vehicles[0]?.id || ''));
    setTipo('');
    setIntervaloKm('');
    setUltimoKm('');
    setAvisoKm('1000');
    setErrorMsg('');
  };

  const handleOpenNew = () => {
    if (!isPremium(user)) {
      setPremiumFeatureName('Gestão de Manutenções');
      setIsPremiumModalOpen(true);
      return;
    }
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (m: Manutencao) => {
    setEditingId(m.id);
    setVehicleId(m.vehicle_id);
    setTipo(m.tipo);
    setIntervaloKm(m.intervalo_km.toString());
    setUltimoKm(m.ultimo_km_realizado.toString());
    setAvisoKm(m.aviso_km_antes.toString());
    setIsFormOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('manutencoes').delete().eq('id', deletingId);
      if (error) throw error;
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir manutenção.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!vehicleId || !tipo || !intervaloKm || !ultimoKm || !avisoKm) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        vehicle_id: vehicleId,
        tipo,
        intervalo_km: Number(intervaloKm),
        ultimo_km_realizado: Number(ultimoKm),
        aviso_km_antes: Number(avisoKm)
      };

      if (editingId) {
        const { error } = await supabase.from('manutencoes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('manutencoes').insert([payload]);
        if (error) throw error;
      }

      setIsFormOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar manutenção.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMaintenance = async (m: Manutencao, currentOdo: number) => {
    // A quick way to update the "ultimo_km_realizado"
    try {
      const { error } = await supabase.from('manutencoes').update({ ultimo_km_realizado: currentOdo }).eq('id', m.id);
      if (error) throw error;
      refetch();
    } catch (error: any) {
      // Ignored for now
      console.error(error);
    }
  };

  // Helper to get current KM for a vehicle
  const getCurrentKm = (vId: string) => {
    const vehicle = vehicles.find(v => v.id === vId);
    if (!vehicle) return 0;
    
    const vLancamentos = lancamentos.filter(l => l.vehicle_id === vId && (l.odometer || l.odometro_receita));
    if (vLancamentos.length === 0) return vehicle.initial_odometer || 0;
    
    let maxKm = vehicle.initial_odometer || 0;
    vLancamentos.forEach(l => {
      const odo = l.odometro_receita || l.odometer || 0;
      if (odo > maxKm) maxKm = odo;
    });
    return maxKm;
  };

  const manutencaoStats = manutencoes.map(m => {
    const currentKm = getCurrentKm(m.vehicle_id);
    const nextKm = m.ultimo_km_realizado + m.intervalo_km;
    const remainingKm = nextKm - currentKm;
    
    let status: 'ok' | 'warning' | 'overdue' = 'ok';
    if (remainingKm < 0) {
      status = 'overdue';
    } else if (remainingKm <= m.aviso_km_antes) {
      status = 'warning';
    }

    return { ...m, currentKm, nextKm, remainingKm, status };
  }).sort((a, b) => a.remainingKm - b.remainingKm);

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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Manutenções</h2>
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

      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-gray-900">
        <div 
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          onClick={handleOpenNew}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Nova Manutenção</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Agendar ou registrar uma manutenção</p>
            </div>
          </div>
          <div className="text-blue-500 dark:text-blue-400">
            <Plus className="h-5 w-5" />
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {manutencaoStats.length === 0 ? (
          <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <Wrench className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma manutenção agendada.</p>
          </div>
        ) : (
          manutencaoStats.map(m => {
            const vehicle = vehicles.find(v => v.id === m.vehicle_id);
            return (
              <Card key={m.id} className={`overflow-hidden border-none shadow-sm bg-white dark:bg-gray-900 ${m.status === 'overdue' ? 'ring-1 ring-red-500/50' : m.status === 'warning' ? 'ring-1 ring-amber-500/50' : ''}`}>
                <div className="p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex flex-1 items-start sm:items-center gap-4">
                    <div className={`p-3 rounded-full shrink-0 ${m.status === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : m.status === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'}`}>
                      {m.status === 'overdue' ? <AlertTriangle className="h-6 w-6" /> : m.status === 'warning' ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg truncate">{m.tipo}</h4>
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Car className="h-3 w-3" /> {vehicle?.name || 'Veículo Inválido'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">KM Atual</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{m.currentKm.toLocaleString('pt-BR')} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Próxima Troca</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">{m.nextKm.toLocaleString('pt-BR')} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                          <p className={`font-bold ${m.status === 'overdue' ? 'text-red-600 dark:text-red-400' : m.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {m.status === 'overdue' ? `${Math.abs(m.remainingKm).toLocaleString('pt-BR')} km atrasado` : 
                             m.status === 'warning' ? `Faltam ${m.remainingKm.toLocaleString('pt-BR')} km` : 
                             `Faltam ${m.remainingKm.toLocaleString('pt-BR')} km`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                    <Button variant="outline" size="sm" onClick={() => handleLogMaintenance(m, m.currentKm)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/50 dark:hover:bg-emerald-900/20" title="Marcar como Realizado (Atualiza Último KM para o Atual)">
                      <CheckCircle className="h-4 w-4 mr-1" /> Realizado
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(m)} className="text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/10 dark:text-[#FBBF24] dark:border-[#FBBF24]/20 dark:hover:bg-[#FBBF24]/10" title="Editar">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => confirmDelete(m.id)} className="text-red-500 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Editar Manutenção' : 'Agendar Manutenção'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
             <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
               {errorMsg}
             </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo *</label>
            <CustomSelect
              value={vehicleId}
              onChange={setVehicleId}
              options={vehicles.map(v => ({ value: v.id, label: v.name }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo (ex: Troca de Óleo, Filtro) *</label>
            <Input
              type="text"
              placeholder="Ex: Troca de Óleo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Último KM Realizado *</label>
              <Input
                type="number"
                 inputMode="numeric"
                placeholder="Ex: 50000"
                value={ultimoKm}
                onChange={(e) => setUltimoKm(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Intervalo (KM) *</label>
              <Input
                type="number"
                 inputMode="numeric"
                placeholder="Ex: 10000"
                value={intervaloKm}
                onChange={(e) => setIntervaloKm(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Avisar faltando quantos KM? *</label>
            <Input
              type="number"
               inputMode="numeric"
              placeholder="Ex: 1000"
              value={avisoKm}
              onChange={(e) => setAvisoKm(e.target.value)}
              required
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
         isOpen={deleteModalOpen}
         onClose={() => setDeleteModalOpen(false)}
         title="Confirmar Exclusão"
       >
         <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
           Tem certeza que deseja excluir este agendamento de manutenção?
         </p>
         <div className="flex justify-end gap-2">
           <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
           <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
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
