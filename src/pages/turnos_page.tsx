import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { User, WorkShift, Vehicle, Lancamento } from '@/types';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, Filter, Calendar, Clock, Lock, 
  ChevronDown, ChevronUp, ChevronLeft, X,
  Plus, Edit2, Trash2, Tag, DollarSign, Car, BarChart2
} from 'lucide-react';
import { useFeatures } from '@/contexts/FeatureContext';
import { 
  parseLocalDate, formatCurrency, cn, getMostUsedVehicleId 
} from '@/lib/utils';
import { 
  format, isWithinInterval, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, startOfYear, endOfYear 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PremiumModal } from '@/components/premium-modal';

interface TurnosPageProps {
  workShifts: WorkShift[];
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  user: User;
  refetch: () => void;
  onBack: () => void;
  onBackToHome: () => void;
}

export function TurnosPage({ 
  workShifts, 
  vehicles, 
  lancamentos, 
  user, 
  refetch, 
  onBack, 
  onBackToHome 
}: TurnosPageProps) {
  const [visibleShiftsCount, setVisibleShiftsCount] = useState(7);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
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

  const mostUsedVehicleId = useMemo(() => getMostUsedVehicleId(vehicles, lancamentos), [vehicles, lancamentos]);

  useEffect(() => {
    if (shiftModalOpen && !editingShiftId && !shiftVehicleId && vehicles.length > 0) {
      setShiftVehicleId(mostUsedVehicleId);
    }
  }, [shiftModalOpen, vehicles, mostUsedVehicleId, editingShiftId]);

  const filteredShifts = useMemo(() => {
    return workShifts.filter(shift => {
      // Vehicle Filter
      if (shiftFilterVehicle !== 'all' && shift.vehicle_id !== shiftFilterVehicle) {
        return false;
      }

      // Time Filter
      const dateObj = parseLocalDate(shift.date);
      const now = new Date();

      if (shiftFilterTime === 'today') {
        if (shift.date !== format(now, 'yyyy-MM-dd')) return false;
      } else if (shiftFilterTime === 'week') {
        const start = startOfWeek(now, { weekStartsOn: 0 });
        const end = endOfWeek(now, { weekStartsOn: 0 });
        if (!isWithinInterval(dateObj, { start, end })) return false;
      } else if (shiftFilterTime === 'month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        if (!isWithinInterval(dateObj, { start, end })) return false;
      } else if (shiftFilterTime === 'year') {
        const start = startOfYear(now);
        const end = endOfYear(now);
        if (!isWithinInterval(dateObj, { start, end })) return false;
      } else if (shiftFilterTime === 'custom') {
        const start = parseLocalDate(shiftFilterStartDate);
        const end = parseLocalDate(shiftFilterEndDate);
        if (!isWithinInterval(dateObj, { start, end })) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date + 'T' + b.start_time).getTime() - new Date(a.date + 'T' + a.start_time).getTime());
  }, [workShifts, shiftFilterTime, shiftFilterVehicle, shiftFilterStartDate, shiftFilterEndDate]);

  const groupedShiftsByDate = useMemo(() => {
    const groups: Record<string, { 
      shifts: WorkShift[]; 
      transactions: Lancamento[];
      totalMinutes: number;
      revenue: number;
      expenses: number;
      categoryBreakdown: Record<string, { value: number; type: string; name: string }>;
      vehicleKM: Record<string, { km: number; vehicleName: string }>;
    }> = {};
    
    filteredShifts.forEach(shift => {
      if (!groups[shift.date]) {
        groups[shift.date] = { 
          shifts: [], 
          transactions: [], 
          totalMinutes: 0, 
          revenue: 0, 
          expenses: 0,
          categoryBreakdown: {},
          vehicleKM: {}
        };
      }
      groups[shift.date].shifts.push(shift);
      
      if (shift.start_time && shift.end_time) {
        const start = new Date(`2000-01-01T${shift.start_time}`);
        const end = new Date(`2000-01-01T${shift.end_time}`);
        let diff = (end.getTime() - start.getTime()) / (1000 * 60);
        if (diff < 0) diff += 24 * 60;
        groups[shift.date].totalMinutes += diff;
      }
    });

    lancamentos.forEach(l => {
      if (!groups[l.data]) return;
      
      groups[l.data].transactions.push(l);
      
      if (l.tipo === 'receita') {
        groups[l.data].revenue += Number(l.valor);
      } else if (l.tipo === 'despesa') {
        groups[l.data].expenses += Number(l.valor);
      }
      
      const catName = l.categorias?.nome || 'Outros';
      const breakdownKey = `${catName}-${l.tipo}`;
      if (!groups[l.data].categoryBreakdown[breakdownKey]) {
        groups[l.data].categoryBreakdown[breakdownKey] = { 
          value: 0, 
          type: l.tipo,
          name: catName 
        };
      }
      groups[l.data].categoryBreakdown[breakdownKey].value += Number(l.valor);
    });

    Object.keys(groups).forEach(date => {
      groups[date].shifts.forEach(shift => {
        if (shift.vehicle_id) {
          const vehicle = vehicles.find(v => v.id === shift.vehicle_id);
          if (vehicle) {
            const km = Math.max(0, (shift.end_odometer || 0) - (shift.start_odometer || 0));
            // In the original code, it was calculating km rodados in turn based on some logic. 
            // Here it uses shift.odometer which is preferred if available.
            const shiftKm = shift.odometer || km;
            
            if (!groups[date].vehicleKM[shift.vehicle_id]) {
              groups[date].vehicleKM[shift.vehicle_id] = { km: shiftKm, vehicleName: vehicle.name };
            } else {
              groups[date].vehicleKM[shift.vehicle_id].km += shiftKm;
            }
          }
        }
      });
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({ date, ...data }));
  }, [filteredShifts, lancamentos, vehicles]);

  const toggleDateExpansion = (date: string) => {
    setExpandedDate(prev => prev === date ? null : date);
  };

  const handleOpenNewShift = () => {
    setEditingShiftId(null);
    setShiftDate(format(new Date(), 'yyyy-MM-dd'));
    setShiftStartTime(format(new Date(), 'HH:mm'));
    setShiftEndTime('');
    setShiftOdometer('');
    setShiftVehicleId(mostUsedVehicleId);
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
              Turnos de Trabalho
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie sua jornada</p>
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 self-start sm:self-auto uppercase tracking-wide text-sm">Meus Turnos</h4>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                variant={showShiftFilters ? "default" : "outline"}
                size="sm" 
                onClick={() => setShowShiftFilters(!showShiftFilters)}
                className={cn(
                  "flex-1 sm:flex-none rounded-xl",
                  showShiftFilters ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 border-transparent shadow-none" : ""
                )}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button onClick={handleOpenNewShift} size="sm" className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          {showShiftFilters && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
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

          {groupedShiftsByDate.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum turno encontrado neste período.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 font-mono">Horas Totais</p>
                  <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100">
                    {(groupedShiftsByDate.reduce((acc, g) => acc + g.totalMinutes, 0) / 60).toFixed(1)}h
                  </p>
                </div>
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1 font-mono">Lucro Líquido</p>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                    {formatCurrency(groupedShiftsByDate.reduce((acc, g) => acc + (g.revenue - g.expenses), 0))}
                  </p>
                </div>
                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/50">
                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 font-mono">KM Rodado</p>
                  <p className="text-2xl font-black text-blue-900 dark:text-blue-100">
                    {Math.round(groupedShiftsByDate.reduce((acc, g) => {
                      return acc + Object.values(g.vehicleKM).reduce((sum, v) => sum + v.km, 0);
                    }, 0))} km
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {groupedShiftsByDate.slice(0, visibleShiftsCount).map((group) => {
                  const isExpanded = expandedDate === group.date;
                  const hours = group.totalMinutes / 60;
                  const hourlyRate = hours > 0 ? group.revenue / hours : 0;

                  return (
                    <div key={group.date} className="overflow-hidden border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-sm transition-all hover:border-indigo-100 dark:hover:border-indigo-900">
                      <div 
                        className="p-4 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleDateExpansion(group.date)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">
                              {format(new Date(group.date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {hours.toFixed(1)}h
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <DollarSign className="h-3 w-3" /> {formatCurrency(group.revenue - group.expenses)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-6 animate-in fade-in slide-in-from-top-1">
                          <div className="h-px bg-gray-50 dark:bg-gray-800 w-full" />
                          
                          {/* Turnos Section */}
                          <div className="space-y-3">
                            <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 flex items-center gap-2">
                              <Clock className="h-3 w-3 text-indigo-500" /> Horários dos Turnos
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.shifts.map(shift => (
                                <div key={shift.id} className="group flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
                                  <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                      {shift.start_time.slice(0, 5)} — {shift.end_time ? shift.end_time.slice(0, 5) : 'Ativo'}
                                    </span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditShift(shift); }} className="h-8 w-8 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); confirmDeleteShift(shift.id); }} className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Detail Section */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Categorias */}
                            <div className="space-y-3">
                              <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                <Tag className="h-3 w-3 text-emerald-500" /> Resumo Financeiro
                              </h5>
                              <div className="space-y-2">
                                {Object.entries(group.categoryBreakdown).map(([key, data]) => {
                                  const displayName = data.name || key.split('-')[0];
                                  return (
                                    <div key={key} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-600 dark:text-gray-400">{displayName}</span>
                                        <span className={`text-[8px] px-1 rounded uppercase font-bold tracking-tight ${
                                          data.type === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                        }`}>
                                          {data.type === 'receita' ? 'Ganho' : 'Gasto'}
                                        </span>
                                      </div>
                                      <span className={`font-bold ${data.type === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(data.value)}
                                      </span>
                                    </div>
                                  );
                                })}
                                <div className="pt-2 flex justify-between items-center mt-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase">Resultado</span>
                                  <span className="text-sm font-black text-gray-900 dark:text-white">
                                    {formatCurrency(group.revenue - group.expenses)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Performance */}
                            <div className="space-y-3">
                              <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                <BarChart2 className="h-3 w-3 text-blue-500" /> Desempenho
                              </h5>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/30 dark:border-indigo-800/30">
                                  <p className="text-[8px] text-indigo-500 font-black uppercase mb-1">Ganho/Hora</p>
                                  <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                                    {formatCurrency(hourlyRate)}
                                  </p>
                                </div>
                                <div className="p-3 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/30 dark:border-emerald-800/30">
                                  <p className="text-[8px] text-emerald-500 font-black uppercase mb-1">Km Rodado</p>
                                  <div className="space-y-1">
                                    {Object.values(group.vehicleKM).length > 0 ? Object.entries(group.vehicleKM).map(([vId, data]) => (
                                      <div key={vId} className="flex justify-between items-center text-[10px]">
                                        <span className="text-emerald-600 font-medium truncate">{data.vehicleName.split(' ')[0]}:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{Math.round(data.km)}km</span>
                                      </div>
                                    )) : <p className="text-[10px] text-gray-400 italic">0 km</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {groupedShiftsByDate.length > visibleShiftsCount && (
                  <Button 
                    variant="ghost" 
                    className="w-full py-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                    onClick={() => setVisibleShiftsCount(prev => prev + 7)}
                  >
                    Carregar mais histórico
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Shift Modal */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => {
          setShiftModalOpen(false);
          setErrorMsg('');
        }}
        title={editingShiftId ? "Editar Turno" : "Novo Turno de Trabalho"}
        className="max-w-md rounded-3xl"
      >
        <form onSubmit={handleSaveShift} className="space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs font-medium rounded-xl border border-rose-100 animate-in shake">
              {errorMsg}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Data</label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Atividade</label>
              <CustomSelect
                value={shiftType}
                onChange={(val) => setShiftType(val as 'work' | 'personal')}
                options={[
                  { value: 'work', label: 'Trabalho' },
                  { value: 'personal', label: 'Particular' }
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Veículo Utilizado</label>
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
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Horário Início</label>
              <Input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Horário Fim</label>
              <Input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Quilometragem Rodada (KM)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={shiftOdometer}
              onChange={(e) => setShiftOdometer(e.target.value)}
              placeholder="Ex: 54.2"
              className="rounded-xl"
            />
            <p className="text-[10px] text-gray-400 italic ml-1">
              Deixe em branco se preferir lançar apenas os horários.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end pt-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setShiftModalOpen(false)} className="w-full sm:w-auto text-gray-500 font-bold">
              Cancelar
            </Button>
            <Button type="submit" disabled={shiftLoading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-indigo-200 shadow-lg">
              {shiftLoading ? 'Processando...' : editingShiftId ? 'Salvar Edição' : 'Registrar Turno'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteShiftModalOpen}
        onClose={() => setDeleteShiftModalOpen(false)}
        title="Excluir Registro"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tem certeza que deseja apagar permanentemente este turno?
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setDeleteShiftModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteShift} className="rounded-xl font-bold">Excluir Turno</Button>
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
