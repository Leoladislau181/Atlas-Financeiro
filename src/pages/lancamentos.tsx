import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { cn, formatCurrency, formatCurrencyInput, parseCurrency, parseLocalDate, isPremium, isPremiumFull, compressImage, getMostUsedVehicleId } from '@/lib/utils';
import { Categoria, Lancamento, TipoLancamento, Vehicle, User, FuelType, WorkShift } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Car, Plus, ChevronUp, Filter, Search, ChevronLeft, ChevronRight, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Lock, Clock, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFuelAutoFill } from '@/hooks/useFuelAutoFill';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { PremiumModal } from '@/components/premium-modal';
import { PremiumLockedOverlay } from '@/components/PremiumLockedOverlay';
import { useFeatures } from '@/contexts/FeatureContext';
import { ShiftTimePicker } from '@/components/ui/shift-time-picker';

interface LancamentosProps {
  categorias: Categoria[];
  lancamentos: Lancamento[];
  vehicles: Vehicle[];
  workShifts: WorkShift[];
  refetch: () => void;
  user: User;
  forceOpenForm?: boolean;
  onFormClose?: () => void;
  onBack?: () => void;
}

interface LancamentoItem {
  categoriaId: string;
  valorStr: string;
}

export function Lancamentos({ categorias, lancamentos, vehicles, workShifts, refetch, user, forceOpenForm, onFormClose, onBack }: LancamentosProps) {
  const { preferences } = useFeatures();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [personalCalculatedValue, setPersonalCalculatedValue] = useState<number>(0);
  const [personalKmRodados, setPersonalKmRodados] = useState<number>(0);
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [items, setItems] = useState<LancamentoItem[]>([{ categoriaId: '', valorStr: '' }]);
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const useVehicle = vehicleId !== '';
  const [odometer, setOdometer] = useState('');
  const [odometroReceita, setOdometroReceita] = useState('');
  const [fuelPricePerLiterStr, setFuelPricePerLiterStr] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [isFullTank, setIsFullTank] = useState(true);
  const [isOdometerManuallyEdited, setIsOdometerManuallyEdited] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState(format(new Date(), 'HH:mm'));
  const [loading, setLoading] = useState(false);

  // Load existing shift data reactively when date or vehicle changes
  useEffect(() => {
    if (tipo === 'receita' && vehicleId && data) {
      const editingLaunch = editingId ? lancamentos.find(l => l.id === editingId) : null;
      const existingShift = workShifts.find(s => 
        (editingLaunch?.group_id && s.group_id === editingLaunch.group_id) || 
        (!editingLaunch?.group_id && s.date === data && s.vehicle_id === vehicleId && !s.group_id)
      );
      
      if (existingShift) {
        setShiftStartTime(existingShift.start_time.substring(0, 5));
        setShiftEndTime(existingShift.end_time?.substring(0, 5) || format(new Date(), 'HH:mm'));
      }
    }
  }, [data, vehicleId, tipo, workShifts, editingId, lancamentos]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const mostUsedVehicleId = useMemo(() => getMostUsedVehicleId(vehicles, lancamentos), [vehicles, lancamentos]);

  // Handle auto-selection of vehicle
  useEffect(() => {
    if (isFormOpen && !editingId && vehicles.length > 0) {
      setVehicleId(mostUsedVehicleId);
    }
  }, [isFormOpen, editingId, vehicles, mostUsedVehicleId]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'receita' | 'despesa'>('all');
  const [filterCategoriaId, setFilterCategoriaId] = useState('all');
  const [filterVehicleId, setFilterVehicleId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getPersonalUseData = (vId: string) => {
    const vehicle = vehicles.find(v => v.id === vId);
    if (!vehicle) return { lastOdo: 0, fuelPrice: 5.5, consumption: 10 };

    // KM Inicial: buscar último odômetro absoluto (apenas Receita ou Pessoal)
    const editingGroupId = editingId ? lancamentos.find(l => l.id === editingId)?.group_id : null;

    const allOdos = lancamentos
      .filter(l => 
        l.vehicle_id === vId && 
        (editingId ? (l.id !== editingId && (!editingGroupId || l.group_id !== editingGroupId)) : true) &&
        (l.odometer || l.odometro_receita) && 
        (l.tipo === 'receita' || l.tipo === 'pessoal')
      )
      .sort((a, b) => {
        const dateA = parseLocalDate(a.data).getTime();
        const dateB = parseLocalDate(b.data).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    const lastOdo = allOdos.length > 0 ? (allOdos[0].odometro_receita || allOdos[0].odometer || 0) : vehicle.initial_odometer;

    // Fuel Price: buscar último abastecimento
    const fuelLancamentos = lancamentos
      .filter(l => l.fuel_price_per_liter && l.fuel_price_per_liter > 0)
      .sort((a, b) => {
        const dateA = parseLocalDate(a.data).getTime();
        const dateB = parseLocalDate(b.data).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    
    const fuelPrice = fuelLancamentos.length > 0 ? fuelLancamentos[0].fuel_price_per_liter! : 5.5;

    const vLancamentos = lancamentos.filter(l => l.vehicle_id === vId);
    const sortedFuelEntries = vLancamentos
      .filter(l => l.tipo === 'despesa' && l.fuel_liters && l.fuel_liters > 0 && l.odometer)
      .sort((a, b) => a.odometer! - b.odometer!);

    let consumption = 10;
    const fullTanks = sortedFuelEntries.filter(l => l.is_full_tank);
    
    if (fullTanks.length >= 2) {
      const recentFullTanks = fullTanks.slice(-4);
      const startFullTank = recentFullTanks[0];
      const endFullTank = recentFullTanks[recentFullTanks.length - 1];
      const distance = endFullTank.odometer! - startFullTank.odometer!;
      const entriesInCycle = sortedFuelEntries.filter(l => l.odometer! > startFullTank.odometer! && l.odometer! <= endFullTank.odometer!);
      const litersInCycle = entriesInCycle.reduce((acc, l) => acc + (l.fuel_liters || 0), 0);
      if (litersInCycle > 0 && distance > 0) {
        consumption = distance / litersInCycle;
      }
    } else {
      const totalLitros = sortedFuelEntries.reduce((acc, l) => acc + (l.fuel_liters || 0), 0);
      let kmRodadoCombustivel = 0;
      sortedFuelEntries.forEach((entry, index) => {
        const prevOdo = index > 0 ? sortedFuelEntries[index - 1].odometer! : (vehicle.initial_odometer || 0);
        const dist = entry.odometer! - (prevOdo || 0);
        if (dist > 0) kmRodadoCombustivel += dist;
      });
      if (totalLitros > 0 && kmRodadoCombustivel > 0) {
        consumption = kmRodadoCombustivel / totalLitros;
      }
    }

    return { lastOdo, fuelPrice, consumption };
  };

  useEffect(() => {
    if (tipo === 'pessoal' && vehicleId && odometer) {
      const { lastOdo, fuelPrice, consumption } = getPersonalUseData(vehicleId);
      const kmRodados = Number(odometer) - lastOdo;
      if (kmRodados > 0) {
        const value = (kmRodados / consumption) * fuelPrice;
        setPersonalCalculatedValue(value);
        setPersonalKmRodados(kmRodados);
      } else {
        setPersonalCalculatedValue(0);
        setPersonalKmRodados(0);
      }
    }
  }, [tipo, vehicleId, odometer]);

  const isCombustivel = () => {
    if (items.length === 0) return false;
    const cat = categorias.find(c => c.id === items[0].categoriaId);
    return cat?.nome.toLowerCase().includes('combustível') || cat?.nome.toLowerCase().includes('combustivel');
  };

  const isOdometerRequired = () => {
    if (items.length === 0) return false;
    const cat = categorias.find(c => c.id === items[0].categoriaId);
    if (!cat) return false;
    const nome = cat.nome.toLowerCase();
    return nome.includes('combustível') || 
           nome.includes('combustivel') || 
           nome.includes('aluguel') || 
           nome.includes('manutenção') || 
           nome.includes('manutencao');
  };

  const getShiftDuration = () => {
    if (!shiftStartTime || !shiftEndTime) return null;
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    
    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Lidar com turnos que viram a noite
    
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return { h, m };
  };

  const durationValue = getShiftDuration();

  const {
    suggestedPricePerLiter,
    suggestedOdometer,
    setLastAutoFillTrigger
  } = useFuelAutoFill({
    vehicleId,
    fuelType,
    lancamentos,
    vehicles,
    isActive: !editingId && useVehicle && tipo === 'despesa' && (isCombustivel() ?? false),
    valorStr: items[0]?.valorStr || '',
    pricePerLiterStr: fuelPricePerLiterStr,
    isOdometerManuallyEdited,
    triggerDependency: items[0]?.categoriaId || ''
  });

  useEffect(() => {
    if (forceOpenForm) {
      setIsFormOpen(true);
    }
  }, [forceOpenForm]);

  useEffect(() => {
    if (!isFormOpen && onFormClose) {
      onFormClose();
    }
  }, [isFormOpen, onFormClose]);

  const lastReferenceOdometer = useMemo(() => {
    if (!vehicleId) return 0;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return 0;

    // Se estiver editando, precisamos excluir todos os lançamentos que pertencem ao mesmo grupo
    const editingGroupId = editingId ? lancamentos.find(l => l.id === editingId)?.group_id : null;

    const allOdos = lancamentos
      .filter(l => 
        l.vehicle_id === vehicleId && 
        (editingId ? (l.id !== editingId && (!editingGroupId || l.group_id !== editingGroupId)) : true) &&
        (l.odometer || l.odometro_receita) && 
        (l.tipo === 'receita' || l.tipo === 'pessoal')
      )
      .sort((a, b) => {
        const dateA = parseLocalDate(a.data).getTime();
        const dateB = parseLocalDate(b.data).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    return allOdos.length > 0 ? (allOdos[0].odometro_receita || allOdos[0].odometer || 0) : vehicle.initial_odometer;
  }, [vehicleId, lancamentos, vehicles, editingId]);

  const nextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const prevMonth = () => setSelectedDate(subMonths(selectedDate, 1));

  const filteredCategorias = categorias.filter((c) => c.tipo === tipo);

  useEffect(() => {
    if (items.length === 1 && items[0].categoriaId === '') {
      if (filteredCategorias.length > 0) {
        setItems([{ categoriaId: filteredCategorias[0].id, valorStr: '' }]);
      }
    } else {
      const newItems = items.map(item => {
        const validCategory = filteredCategorias.find(c => c.id === item.categoriaId);
        if (!validCategory && filteredCategorias.length > 0) {
          return { ...item, categoriaId: filteredCategorias[0].id };
        }
        return item;
      });
      if (JSON.stringify(newItems) !== JSON.stringify(items)) {
        setItems(newItems);
      }
    }
  }, [tipo, categorias]);

  const addItem = () => {
    if (filteredCategorias.length > 0) {
      setItems([...items, { categoriaId: filteredCategorias[0].id, valorStr: '' }]);
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const updateItem = (index: number, field: keyof LancamentoItem, value: string) => {
    const newItems = [...items];
    if (field === 'valorStr') {
      newItems[index].valorStr = formatCurrencyInput(value);
    } else {
      newItems[index].categoriaId = value;
    }
    setItems(newItems);
  };

  const totalValor = items.reduce((acc, item) => acc + parseCurrency(item.valorStr), 0);

  useEffect(() => {
    if (suggestedPricePerLiter !== null) {
      setFuelPricePerLiterStr(suggestedPricePerLiter);
    }
  }, [suggestedPricePerLiter]);

  useEffect(() => {
    if (suggestedOdometer !== null) {
      setOdometer(suggestedOdometer);
    }
  }, [suggestedOdometer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (tipo !== 'pessoal' && (items.some(item => !item.categoriaId || !item.valorStr) || !data)) {
      setErrorMsg('Preencha os campos obrigatórios.');
      return;
    }

    if (tipo === 'pessoal' && (!vehicleId || !odometer)) {
      setErrorMsg('Informe o veículo e o odômetro final.');
      return;
    }

    if (tipo === 'receita' && preferences.modulo_turnos && (!shiftStartTime || !shiftEndTime)) {
      setErrorMsg('Informe o horário de início e fim da jornada de trabalho.');
      return;
    }

    if (useVehicle && !vehicleId) {
      setErrorMsg('Selecione um veículo.');
      return;
    }

    if (useVehicle && tipo === 'despesa' && isOdometerRequired() && !odometer) {
      setErrorMsg('O odômetro é obrigatório para esta categoria de despesa.');
      return;
    }

    // Duplicate category check (not applicable to 'pessoal')
    if (tipo !== 'pessoal') {
      const categoryIds = items.map(i => i.categoriaId);
      if (new Set(categoryIds).size !== categoryIds.length) {
        setErrorMsg('Não é permitido repetir a mesma categoria no mesmo lançamento.');
        return;
      }
    }

    const totalValorNum = tipo === 'pessoal' ? personalCalculatedValue : totalValor;
    if (totalValorNum <= 0) {
      setErrorMsg('O valor total deve ser maior que zero.');
      return;
    }

    if (!editingId && !isPremium(user)) {
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

    if (useVehicle && (odometer || odometroReceita)) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const newOdo = odometer ? Number(odometer) : Number(odometroReceita);
      
      // Busca o maior odômetro absoluto já registrado para este veículo (apenas Receita ou Pessoal)
      const allOdos = lancamentos
        .filter(l => l.vehicle_id === vehicleId && (l.odometer || l.odometro_receita) && (l.tipo === 'receita' || l.tipo === 'pessoal'))
        .map(l => l.odometro_receita || l.odometer || 0);
      
      const lastOdo = allOdos.length > 0 ? Math.max(...allOdos) : (vehicle?.initial_odometer || 0);

      if (newOdo <= lastOdo && !editingId) {
        setErrorMsg(`O odômetro atual (${newOdo}) deve ser maior que o último registrado (${lastOdo}).`);
        return;
      }
    }

    setLoading(true);
    try {
      if (!isPremium(user)) {
        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const endOfCurrentMonth = endOfMonth(now);
        
        const monthEntriesCount = lancamentos.filter(l => {
          const lDate = parseLocalDate(l.data);
          return isWithinInterval(lDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
        }).length;

        if (monthEntriesCount >= 50 && !editingId) {
          setPremiumFeatureName('Lançamentos Ilimitados');
          setIsPremiumModalOpen(true);
          setLoading(false);
          return;
        }
      }

      let finalPayloads: any[] = [];
      const originalLaunch = editingId ? lancamentos.find(l => l.id === editingId) : null;
      let groupId = items.length > 1 
        ? (originalLaunch?.group_id || crypto.randomUUID()) 
        : null;

      if (tipo === 'pessoal') {
        // Handle personal use
        let personalCatId = '';
        const personalCat = categorias.find(c => c.nome.toLowerCase() === 'uso pessoal');
        if (personalCat) {
          personalCatId = personalCat.id;
        } else {
          const { data: newCat, error: catError } = await supabase
            .from('categorias')
            .insert([{ user_id: user.id, nome: 'Uso Pessoal', tipo: 'despesa' }])
            .select()
            .single();
          if (catError) throw catError;
          personalCatId = newCat.id;
        }

        finalPayloads = [{
          user_id: user.id,
          tipo: 'pessoal',
          categoria_id: personalCatId,
          valor: personalCalculatedValue,
          data,
          observacao,
          vehicle_id: vehicleId,
          odometer: Number(odometer),
          km_rodados: personalKmRodados,
          fuel_price_per_liter: null,
          fuel_liters: null,
          fuel_type: null,
          is_full_tank: null,
        }];
      } else {
        // Handle Income/Expense
        let kmRodados = null;
        let odoReceitaNum = odometroReceita ? Number(odometroReceita) : null;
        
        if (tipo === 'receita' && odoReceitaNum && useVehicle) {
          const vehicle = vehicles.find(v => v.id === vehicleId);
          let lastOdoRef = null;

          if (vehicle) {
            const editingGroupId = editingId ? lancamentos.find(l => l.id === editingId)?.group_id : null;

            // Busca o último odômetro absoluto registrado (Receita ou Pessoal) excluindo o registro atual ou o seu grupo se for edição
            const odoEntries = lancamentos
              .filter(l => 
                l.vehicle_id === vehicleId && 
                (editingId ? (l.id !== editingId && (!editingGroupId || l.group_id !== editingGroupId)) : true) &&
                (l.odometer || l.odometro_receita) && 
                (l.tipo === 'receita' || l.tipo === 'pessoal')
              )
              .sort((a, b) => {
                const dateA = parseLocalDate(a.data).getTime();
                const dateB = parseLocalDate(b.data).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });

            if (odoEntries.length > 0) {
              lastOdoRef = odoEntries[0].odometro_receita || odoEntries[0].odometer;
            } else {
              lastOdoRef = vehicle.initial_odometer;
            }
          }

          if (lastOdoRef !== null && odoReceitaNum) {
            kmRodados = odoReceitaNum - lastOdoRef;
          }
        }

        finalPayloads = items.map((item) => {
          const valorNum = parseCurrency(item.valorStr);
          const payload: any = {
            user_id: user.id,
            tipo,
            categoria_id: item.categoriaId,
            valor: valorNum,
            data,
            observacao,
            vehicle_id: useVehicle ? vehicleId : null,
            group_id: groupId,
            odometro_receita: tipo === 'receita' && odoReceitaNum ? odoReceitaNum : null,
            km_rodados: tipo === 'receita' ? kmRodados : null,
            odometer: useVehicle && tipo === 'despesa' && odometer ? Number(odometer) : null,
            fuel_price_per_liter: null,
            fuel_liters: null,
            fuel_type: null,
            is_full_tank: null,
          };

          if (useVehicle && tipo === 'despesa' && isCombustivel()) {
            const pricePerLiter = parseCurrency(fuelPricePerLiterStr);
            if (pricePerLiter > 0 && valorNum > 0) {
              payload.fuel_price_per_liter = pricePerLiter;
              payload.fuel_liters = valorNum / pricePerLiter;
              payload.fuel_type = fuelType;
              payload.is_full_tank = isFullTank;
            }
          }
          return payload;
        });
      }
      
      if (editingId) {
        const original = lancamentos.find(l => l.id === editingId);
        if (original?.group_id) {
          await supabase.from('lancamentos').delete().eq('group_id', original.group_id);
          // Se o group_id for mudar (ex: de múltiplos para único), deletamos o turno do grupo original
          if (!groupId || groupId !== original.group_id) {
            await supabase.from('work_shifts').delete().eq('group_id', original.group_id);
          }
        } else {
          await supabase.from('lancamentos').delete().eq('id', editingId);
          // Se era único e agora é múltiplo, limpamos o turno "sem grupo" do dia original
          if (groupId) {
             await supabase.from('work_shifts').delete()
              .eq('user_id', user.id)
              .eq('vehicle_id', original?.vehicle_id || vehicleId)
              .eq('date', original?.data || data)
              .is('group_id', null);
          }
        }
        const { error } = await supabase.from('lancamentos').insert(finalPayloads);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lancamentos').insert(finalPayloads);
        if (error) throw error;
      }

      // Helper function to sync work shift for a given context
      const syncDayShift = async (vId: string, d: string, gId: string | null) => {
        // Fetch all revenues for this specific context
        let query = supabase
          .from('lancamentos')
          .select('*')
          .eq('user_id', user.id)
          .eq('vehicle_id', vId)
          .eq('data', d)
          .eq('tipo', 'receita');

        if (gId) {
          query = query.eq('group_id', gId);
        } else {
          query = query.is('group_id', null);
        }

        const { data: dayRevenues, error: revError } = await query.order('created_at', { ascending: true });
        if (revError) throw revError;

        if (!dayRevenues || dayRevenues.length === 0) {
          // No more revenues for this context, delete the shift
          const delQuery = supabase
            .from('work_shifts')
            .delete()
            .eq('user_id', user.id)
            .eq('vehicle_id', vId)
            .eq('date', d);
          
          if (gId) {
            await delQuery.eq('group_id', gId);
          } else {
            await delQuery.is('group_id', null);
          }
          return;
        }

        // We have revenues, so sync the shift
        const firstRev = dayRevenues[0];
        const lastRev = dayRevenues[dayRevenues.length - 1];

        // Find absolute last odometer recorded before this day
        const { data: lastGlobalOdos } = await supabase
          .from('lancamentos')
          .select('odometer, odometro_receita')
          .eq('user_id', user.id)
          .eq('vehicle_id', vId)
          .in('tipo', ['receita', 'pessoal'])
          .lt('data', d)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);

        const startOdo = lastGlobalOdos?.[0] 
          ? (lastGlobalOdos[0].odometro_receita || lastGlobalOdos[0].odometer || 0)
          : vehicles.find(v => v.id === vId)?.initial_odometer || 0;

        const endOdo = lastRev.odometro_receita || 0;

        const shiftPayload: any = {
          user_id: user.id,
          vehicle_id: vId,
          type: 'work',
          date: d,
          // Use provided shift times if this is the current launch being handled, 
          // but we'll try to find existing shift times first to preserve manual edits
          start_time: (firstRev.id === editingId || (groupId && firstRev.group_id === groupId)) 
            ? (shiftStartTime || firstRev.created_at.substring(11, 16))
            : firstRev.created_at.substring(11, 16),
          end_time: (lastRev.id === editingId || (groupId && lastRev.group_id === groupId))
            ? (shiftEndTime || format(new Date(), 'HH:mm'))
            : lastRev.created_at.substring(11, 16),
          start_odometer: startOdo,
          end_odometer: endOdo,
          status: 'closed'
        };

        if (gId) shiftPayload.group_id = gId;

        // Check for existing shift to preserve times
        const sQuery = supabase.from('work_shifts').select('id, start_time, end_time').eq('user_id', user.id).eq('vehicle_id', vId).eq('date', d);
        if (gId) sQuery.eq('group_id', gId); else sQuery.is('group_id', null);
        const { data: existingS } = await sQuery.limit(1);

        if (existingS && existingS.length > 0) {
          // Preserve manual times if we are just background syncing, but use form values if they were just provided
          const currentContext = (vId === vehicleId && d === data && gId === groupId);
          if (currentContext) {
            if (shiftStartTime) shiftPayload.start_time = shiftStartTime;
            if (shiftEndTime) shiftPayload.end_time = shiftEndTime;
          } else {
             shiftPayload.start_time = existingS[0].start_time.substring(0, 5);
             if (existingS[0].end_time) shiftPayload.end_time = existingS[0].end_time.substring(0, 5);
          }
          await supabase.from('work_shifts').update(shiftPayload).eq('id', existingS[0].id);
        } else {
          await supabase.from('work_shifts').insert([shiftPayload]);
        }
      };

      // If editing, and date/vehicle/group changed, or was a revenue but isn't anymore
      if (editingId && originalLaunch) {
        const dateChanged = originalLaunch.data !== data;
        const vehicleChanged = originalLaunch.vehicle_id !== vehicleId;
        const wasRevenue = originalLaunch.tipo === 'receita';
        
        if (wasRevenue) {
          // Sync old state (it might now be empty or have fewer revenues)
          await syncDayShift(originalLaunch.vehicle_id || '', originalLaunch.data, originalLaunch.group_id || null);
        }
      }

      // Sync current state if it's a revenue
      if (tipo === 'receita' && useVehicle && vehicleId) {
        await syncDayShift(vehicleId, data, groupId);
      }

      setTipo('despesa');
      setItems([{ categoriaId: '', valorStr: '' }]);
      setData(format(new Date(), 'yyyy-MM-dd'));
      setObservacao('');
      setVehicleId('');
      setOdometer('');
      setOdometroReceita('');
      setShiftStartTime('');
      setShiftEndTime(format(new Date(), 'HH:mm'));
      setFuelPricePerLiterStr('');
      setFuelType(null);
      setIsFullTank(true);
      setEditingId(null);
      setIsFormOpen(false);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao salvar lançamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lancamento: Lancamento) => {
    setEditingId(lancamento.id);
    setIsFormOpen(true);
    setTipo(lancamento.tipo);
    setData(lancamento.data);
    setObservacao(lancamento.observacao || '');
    setVehicleId(lancamento.vehicle_id || '');
    setOdometroReceita(lancamento.odometro_receita ? lancamento.odometro_receita.toString() : '');
    
    if (lancamento.group_id) {
      const groupItems = lancamentos.filter(l => l.group_id === lancamento.group_id);
      setItems(groupItems.map(l => ({ categoriaId: l.categoria_id, valorStr: formatCurrency(l.valor) })));
    } else {
      setItems([{ categoriaId: lancamento.categoria_id, valorStr: formatCurrency(lancamento.valor) }]);
    }

    if (lancamento.vehicle_id) {
      setOdometer(lancamento.odometer ? lancamento.odometer.toString() : '');
      if (lancamento.fuel_price_per_liter) {
        setFuelPricePerLiterStr(formatCurrency(lancamento.fuel_price_per_liter));
      } else {
        setFuelPricePerLiterStr('');
      }
      setFuelType(lancamento.fuel_type || null);
      setIsFullTank(lancamento.is_full_tank ?? true);

      // Populate shift times if available
      const existingShift = workShifts.find(s => 
        (lancamento.group_id && s.group_id === lancamento.group_id) || 
        (!lancamento.group_id && s.date === lancamento.data && s.vehicle_id === lancamento.vehicle_id && !s.group_id)
      );
      if (existingShift) {
        setShiftStartTime(existingShift.start_time.substring(0, 5));
        setShiftEndTime(existingShift.end_time?.substring(0, 5) || '');
      }
    } else {
      setOdometer('');
      setFuelPricePerLiterStr('');
      setFuelType(null);
      setIsFullTank(true);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const lancamento = lancamentos.find(l => l.id === deletingId);
      if (lancamento?.group_id) {
        await supabase.from('lancamentos').delete().eq('group_id', lancamento.group_id);
        await supabase.from('work_shifts').delete().eq('group_id', lancamento.group_id);
      } else {
        await supabase.from('lancamentos').delete().eq('id', deletingId);
      }
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir lançamento.');
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const filteredLancamentos = lancamentos.filter((l) => {
    const dataLancamento = parseLocalDate(l.data);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    
    const matchesMonth = isWithinInterval(dataLancamento, { start: monthStart, end: monthEnd });
    const matchesTipo = filterTipo === 'all' || l.tipo === filterTipo;
    const matchesCategoria = filterCategoriaId === 'all' || l.categoria_id === filterCategoriaId;
    const matchesVehicle = filterVehicleId === 'all' || l.vehicle_id === filterVehicleId;
    const matchesSearch = !searchTerm || 
      (l.observacao && l.observacao.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.categorias && l.categorias.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.valor.toString().includes(searchTerm));
      
    return matchesMonth && matchesTipo && matchesCategoria && matchesVehicle && matchesSearch;
  });

   const groupedLancamentos = useMemo(() => {
    const allGroups: { [key: string]: Lancamento[] } = {};
    lancamentos.forEach(l => {
      if (l.group_id) {
        if (!allGroups[l.group_id]) allGroups[l.group_id] = [];
        allGroups[l.group_id].push(l);
      }
    });

    const processedGroups = new Set<string>();
    const result: any[] = [];

    filteredLancamentos.forEach(l => {
      if (l.group_id) {
        if (processedGroups.has(l.group_id)) return;
        
        const group = allGroups[l.group_id];
        const mainItem = group.find(item => item.km_rodados != null) || 
                         group.find(item => item.odometro_receita != null) || 
                         group[0];
        const total = group.reduce((acc, curr) => acc + Number(curr.valor), 0);
        
        // Calculate total time worked for this group
        const groupShifts = workShifts.filter(s => 
          (s.group_id === l.group_id) || 
          (!s.group_id && s.date === l.data && s.vehicle_id === l.vehicle_id)
        );
        let totalMinutes = 0;
        groupShifts.forEach(s => {
          if (s.start_time && s.end_time) {
            const start = new Date(`2000-01-01T${s.start_time}`);
            const end = new Date(`2000-01-01T${s.end_time}`);
            const diff = (end.getTime() - start.getTime()) / (1000 * 60);
            if (diff > 0) totalMinutes += diff;
          }
        });

        result.push({
          ...mainItem,
          valor: total,
          categoria_id: 'multiple',
          total_minutes: totalMinutes > 0 ? totalMinutes : null,
          earning_per_hour: (totalMinutes > 0 && total > 0) ? (total / (totalMinutes / 60)) : null
        });
        processedGroups.add(l.group_id);
      } else {
        // Single item might also have shifts
        const itemShifts = workShifts.filter(s => 
          (s.group_id === l.group_id && l.group_id) || 
          (l.id && s.group_id === l.id) ||
          (!s.group_id && s.date === l.data && s.vehicle_id === l.vehicle_id)
        );
        let totalMinutes = 0;
        itemShifts.forEach(s => {
          if (s.start_time && s.end_time) {
            const start = new Date(`2000-01-01T${s.start_time}`);
            const end = new Date(`2000-01-01T${s.end_time}`);
            const diff = (end.getTime() - start.getTime()) / (1000 * 60);
            if (diff > 0) totalMinutes += diff;
          }
        });

        result.push({
          ...l,
          total_minutes: totalMinutes > 0 ? totalMinutes : null,
          earning_per_hour: (totalMinutes > 0 && l.valor > 0) ? (l.valor / (totalMinutes / 60)) : null
        });
      }
    });

    return result.sort((a, b) => {
      const dateA = parseLocalDate(a.data).getTime();
      const dateB = parseLocalDate(b.data).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredLancamentos, lancamentos, workShifts]);

  const monthSummary = React.useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    let pessoalKm = 0;
    let pessoalCusto = 0;
    filteredLancamentos.forEach(l => {
      const valor = Number(l.valor);
      if (l.tipo === 'receita') receitas += valor;
      else if (l.tipo === 'despesa') despesas += valor;
      else if (l.tipo === 'pessoal') {
        pessoalCusto += valor;
        pessoalKm += (l.km_rodados || 0);
      }
    });
    return { receitas, despesas, saldo: receitas - despesas, pessoalKm, pessoalCusto };
  }, [filteredLancamentos]);

  const visibleLancamentos = groupedLancamentos.slice(0, visibleCount);
  const hasMore = visibleCount < groupedLancamentos.length;

  const hasTransactions = lancamentos.length > 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Page Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="h-10 w-10 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Lançamentos</h1>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="h-10 w-10 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-xl text-sm flex justify-between items-center">
          <span>{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg('')}>OK</Button>
        </div>
      )}

      {!hasTransactions && (
        <OnboardingGuide
          step="transaction"
          title="Registre seu primeiro lançamento"
          description="Tudo pronto! Agora é só registrar seu primeiro gasto ou ganho para ver os gráficos."
          onClick={() => setIsFormOpen(true)}
          buttonText="Novo Lançamento"
        />
      )}

      {/* Month Selector Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="w-10 sm:hidden"></div> {/* Spacer for mobile centering balance */}
        <div className="flex items-center justify-center flex-1">
          <Button
            variant="ghost"
            onClick={prevMonth}
            className="h-10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full px-2 sm:px-3 flex items-center gap-1"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden sm:inline text-xs capitalize">{format(subMonths(selectedDate, 1), 'MMM', { locale: ptBR })}</span>
          </Button>
          
          <div className="text-center mx-1 sm:mx-4 min-w-[120px] sm:min-w-[140px]">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">
              {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              {filteredLancamentos.length} lançamentos
            </p>
          </div>

          <Button
            variant="ghost"
            onClick={nextMonth}
            className="h-10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full px-2 sm:px-3 flex items-center gap-1"
          >
            <span className="hidden sm:inline text-xs capitalize">{format(addMonths(selectedDate, 1), 'MMM', { locale: ptBR })}</span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center justify-end w-10 sm:w-auto sm:ml-4 gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-9 w-9 sm:h-11 sm:w-11 rounded-xl transition-all",
              showFilters 
                ? "bg-[#F59E0B] text-white border-[#F59E0B] hover:bg-[#D97706]" 
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

      {/* Month Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receitas</p>
              <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {formatCurrency(monthSummary.receitas)}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-xl shrink-0">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Despesas</p>
              <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {formatCurrency(monthSummary.despesas)}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className={cn(
              "p-2 sm:p-3 rounded-xl shrink-0",
              monthSummary.saldo >= 0 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-red-50 dark:bg-red-900/20"
            )}>
              <DollarSign className={cn(
                "h-4 w-4 sm:h-5 sm:w-5",
                monthSummary.saldo >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
              )} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Líquido</p>
              <h3 className={cn(
                "text-sm sm:text-lg font-bold truncate",
                monthSummary.saldo >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(monthSummary.saldo)}
              </h3>
            </div>
          </CardContent>
        </Card>
        {preferences.modulo_pessoal && (
          <Card className="bg-white dark:bg-gray-900 border-none shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl shrink-0">
                <Car className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pessoal</p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0 sm:gap-1">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {monthSummary.pessoalKm} km
                  </h3>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500">
                    ({formatCurrency(monthSummary.pessoalCusto)})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showFilters && (
        <Card className="border-none shadow-md bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Busca</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="O que você procura?"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</label>
                <CustomSelect
                  value={filterTipo}
                  onChange={(val) => setFilterTipo(val as any)}
                  className="h-11 rounded-xl border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                  options={[
                    { value: 'all', label: 'Todos os Tipos' },
                    { value: 'receita', label: 'Receitas' },
                    { value: 'despesa', label: 'Despesas' }
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</label>
                <CustomSelect
                  value={filterCategoriaId}
                  onChange={setFilterCategoriaId}
                  className="h-11 rounded-xl border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                  options={[
                    { value: 'all', label: 'Todas as Categorias' },
                    ...categorias.map(c => ({ value: c.id, label: c.nome }))
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</label>
                <CustomSelect
                  value={filterVehicleId}
                  onChange={setFilterVehicleId}
                  className="h-11 rounded-xl border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                  options={[
                    { value: 'all', label: 'Todos os Veículos' },
                    ...vehicles.map(v => ({ value: v.id, label: `${v.name} - ${v.plate}` }))
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setErrorMsg('');
        }}
        title={editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo do Lançamento</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={tipo === 'receita' ? 'default' : 'outline'}
                  className={cn(
                    "h-10 text-xs font-bold uppercase tracking-wider",
                    tipo === 'receita' ? "bg-[#10B981] hover:bg-[#059568] border-none text-white shadow-sm" : "border-gray-200 text-gray-500"
                  )}
                  onClick={() => setTipo('receita')}
                >
                  Receita
                </Button>
                <Button
                  type="button"
                  variant={tipo === 'despesa' ? 'default' : 'outline'}
                  className={cn(
                    "h-10 text-xs font-bold uppercase tracking-wider",
                    tipo === 'despesa' ? "bg-[#EF4444] hover:bg-[#DC2626] border-none text-white shadow-sm" : "border-gray-200 text-gray-500"
                  )}
                  onClick={() => {
                    setTipo('despesa');
                  }}
                >
                  Despesa
                </Button>
                {preferences.modulo_pessoal && (
                  <Button
                    type="button"
                    variant={tipo === 'pessoal' ? 'default' : 'outline'}
                    className={cn(
                      "h-10 text-xs font-bold uppercase tracking-wider",
                      tipo === 'pessoal' ? "bg-blue-600 hover:bg-blue-700 border-none text-white shadow-sm" : "border-gray-200 text-gray-500"
                    )}
                    onClick={() => {
                      setTipo('pessoal');
                    }}
                  >
                    Pessoal
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data</label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          </div>

          {tipo === 'pessoal' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vehicles.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo</label>
                    <CustomSelect
                      value={vehicleId}
                      onChange={setVehicleId}
                      options={vehicles.map(v => ({ value: v.id, label: `${v.name} - ${v.plate}` }))}
                      placeholder="Selecione o veículo..."
                    />
                  </div>
                )}
                <div className={cn("space-y-2", vehicles.length <= 1 && "md:col-span-2")}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Odômetro Final (KM)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 50100"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    required
                  />
                </div>
              </div>

              {vehicleId && odometer && personalKmRodados > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300">Odômetro Anterior:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{lastReferenceOdometer} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300">Distância Percorrida:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{personalKmRodados} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300">Custo Estimado:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency(personalCalculatedValue)}</span>
                  </div>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2 italic">
                    * Cálculo baseado no consumo médio do veículo e no último preço de combustível registrado.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observação (Onde você foi?)</label>
                <Input
                  type="text"
                  placeholder="Ex: Fui ao mercado / academia"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <React.Fragment>
              <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Itens do Lançamento</label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Adicionar Item
              </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 relative group">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500">Categoria</label>
                  <CustomSelect 
                    value={item.categoriaId} 
                    onChange={(val) => updateItem(index, 'categoriaId', val)}
                    options={filteredCategorias.map(c => ({ value: c.id, label: c.nome }))}
                    placeholder="Selecione..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500">Valor</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={item.valorStr}
                    onChange={(e) => updateItem(index, 'valorStr', e.target.value)}
                    required
                  />
                </div>
                {items.length > 1 && (
                  <div className="sm:col-span-1 flex items-end justify-center pb-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(index)}
                      className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {items.length > 1 && (
              <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100">Total do Lançamento</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalValor)}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {vehicles.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo (Opcional)</label>
                <CustomSelect 
                  value={vehicleId} 
                  onChange={setVehicleId}
                  options={[
                    { value: '', label: 'Nenhum veículo' },
                    ...vehicles
                      .filter(v => v.status === 'active' || v.id === vehicleId)
                      .map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
                  ]}
                />
              </div>
            )}

            {useVehicle && tipo === 'receita' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-blue-900 dark:text-blue-100">Odômetro Final (KM) - Opcional</label>
                  {lastReferenceOdometer > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      Anterior: {lastReferenceOdometer} km
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 50100"
                  value={odometroReceita}
                  onChange={(e) => setOdometroReceita(e.target.value)}
                  className="bg-white dark:bg-gray-900"
                />
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Usado para calcular a quilometragem rodada desde o último registro.</p>
              </div>
            )}

            {useVehicle && tipo === 'despesa' && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Odômetro Atual (KM) {isOdometerRequired() ? '*' : '(Opcional)'}
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ex: 50100"
                      value={odometer}
                      onChange={(e) => {
                        setOdometer(e.target.value);
                        setIsOdometerManuallyEdited(true);
                      }}
                      required={useVehicle && tipo === 'despesa' && isOdometerRequired()}
                    />
                  </div>

                  {isCombustivel() && preferences.modulo_abastecimento_detalhado && (
                    <PremiumLockedOverlay
                      user={user}
                      onUnlock={() => { setPremiumFeatureName('Abastecimento Detalhado'); setIsPremiumModalOpen(true); }}
                      className="md:col-span-2"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Combustível</label>
                          <CustomSelect
                            value={fuelType || ''}
                            onChange={(val) => setFuelType(val as FuelType)}
                            options={[
                              { value: 'gasolina', label: 'Gasolina' },
                              { value: 'etanol', label: 'Etanol' },
                              { value: 'diesel', label: 'Diesel' },
                              { value: 'gnv', label: 'GNV' },
                            ]}
                            placeholder="Selecione o combustível"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor por Litro</label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="R$ 0,00"
                            value={fuelPricePerLiterStr}
                            onChange={(e) => setFuelPricePerLiterStr(formatCurrencyInput(e.target.value))}
                            required={useVehicle && tipo === 'despesa' && isCombustivel() && isPremium(user)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Litros (Calculado)</label>
                          <Input
                            type="text"
                            value={
                              parseCurrency(fuelPricePerLiterStr) > 0 && parseCurrency(items[0]?.valorStr || '') > 0
                                ? (parseCurrency(items[0]?.valorStr || '') / parseCurrency(fuelPricePerLiterStr)).toFixed(2) + ' L'
                                : '0.00 L'
                            }
                            disabled
                            className="bg-gray-100 dark:bg-gray-800"
                          />
                        </div>
                        <div className="space-y-2 flex items-center pt-2">
                          <input
                            type="checkbox"
                            id="isFullTank"
                            checked={isFullTank}
                            onChange={(e) => setIsFullTank(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                          />
                          <label htmlFor="isFullTank" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            Tanque Cheio?
                          </label>
                        </div>
                      </div>
                    </PremiumLockedOverlay>
                  )}
                </div>
              )}
            </div>

            {useVehicle && tipo === 'receita' && preferences.modulo_turnos && (
              <PremiumLockedOverlay
                user={user}
                onUnlock={() => { setPremiumFeatureName('Gestão de Turnos'); setIsPremiumModalOpen(true); }}
              >
                <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-gray-900 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-200 dark:shadow-none">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                      <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tighter">Turno de Trabalho</h4>
                    </div>
                    {durationValue && (
                      <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-full border border-indigo-200 dark:border-indigo-800">
                        <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase italic">
                          Duração: {durationValue.h}h {durationValue.m.toString().padStart(2, '0')}m
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <ShiftTimePicker
                      label="Início da Jornada"
                      value={shiftStartTime}
                      onChange={setShiftStartTime}
                    />
                    <ShiftTimePicker
                      label="Fim da Jornada"
                      value={shiftEndTime}
                      onChange={setShiftEndTime}
                    />
                  </div>
                  
                  <div className="flex gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/50">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">
                      <span className="font-black uppercase mr-1">Nota:</span>
                      O odômetro inicial é carregado automaticamente do seu último registro. O odômetro final será o valor informado neste lançamento.
                    </p>
                  </div>
                </div>
              </PremiumLockedOverlay>
            )}
            </React.Fragment>
          )}

            {tipo !== 'pessoal' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observação</label>
                <Input
                  type="text"
                  placeholder="Detalhes do lançamento..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2 pb-48">
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingId(null);
                  setItems([{ categoriaId: '', valorStr: '' }]);
                  setObservacao('');
                  setIsFormOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || (tipo !== 'pessoal' && filteredCategorias.length === 0)} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706] text-white">
                {loading ? 'Salvando...' : editingId ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
              </Button>
            </div>
        </form>
      </Modal>

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Veículo</th>
                  <th className="px-6 py-4">Observação</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Nenhum lançamento encontrado para este período.
                    </td>
                  </tr>
                ) : (
                  visibleLancamentos.map((l) => {
                    const isMultiple = l.categoria_id === 'multiple';
                    const groupItems = isMultiple ? lancamentos.filter(item => item.group_id === l.group_id) : [];
                    const isExpanded = expandedId === l.id;

                    return (
                      <React.Fragment key={l.id}>
                        <tr 
                          onClick={() => setExpandedId(isExpanded ? null : l.id)}
                          className={cn(
                            "border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group cursor-pointer",
                            isExpanded && "bg-gray-50 dark:bg-gray-800/40"
                          )}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            {format(parseLocalDate(l.data), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              l.tipo === 'receita'
                                ? 'bg-green-50 dark:bg-[#059568]/10 text-[#059568] dark:text-[#10B981]'
                                : l.tipo === 'pessoal'
                                ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400'
                                : 'bg-red-50 dark:bg-[#EF4444]/10 text-[#EF4444] dark:text-[#F87171]'
                            }`}
                          >
                            {l.tipo === 'receita' ? 'Receita' : l.tipo === 'pessoal' ? 'Pessoal' : 'Despesa'}
                          </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {isMultiple ? (
                              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                Múltipla
                                <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded text-[10px]">{groupItems.length} itens</span>
                              </span>
                            ) : (
                              l.categorias?.nome || 'N/A'
                            )}
                            {l.fuel_type && (
                              <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                {l.fuel_type}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {l.vehicles ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                <Car className="h-3 w-3" />
                                {l.vehicles.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 max-w-[200px] truncate text-xs text-gray-500 dark:text-gray-400" title={l.observacao}>
                            {l.observacao || '-'}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-bold text-sm whitespace-nowrap ${
                              l.tipo === 'receita' ? 'text-[#059568] dark:text-[#10B981]' : 
                              l.tipo === 'pessoal' ? 'text-blue-500 dark:text-blue-400 opacity-80' :
                              'text-[#EF4444] dark:text-[#F87171]'
                            }`}
                          >
                            {l.tipo === 'receita' ? '+' : l.tipo === 'pessoal' ? 'ℹ ' : '-'}{formatCurrency(l.valor)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(l); }}
                                className="p-2 text-gray-400 dark:text-gray-500 hover:text-[#F59E0B] dark:hover:text-[#FBBF24] hover:bg-orange-50 dark:hover:bg-[#F59E0B]/10 rounded-lg transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); confirmDelete(l.id); }}
                                className="p-2 text-gray-400 dark:text-gray-500 hover:text-[#EF4444] dark:hover:text-[#F87171] hover:bg-red-50 dark:hover:bg-[#EF4444]/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/50 dark:bg-gray-800/10">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {isMultiple && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {groupItems.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.categorias?.nome}</span>
                                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{formatCurrency(item.valor)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                                  {l.km_rodados != null && (
                                    <>
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                                        <TrendingUp className="h-3.5 w-3.5" />
                                        {l.km_rodados} KM rodados para este lançamento
                                      </div>
                                      {l.km_rodados > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                          <DollarSign className="h-3.5 w-3.5" />
                                          {isPremium(user) ? (
                                            `Lucro por KM: ${formatCurrency(Number(l.valor) / l.km_rodados)}/km`
                                          ) : (
                                            <span className="flex items-center gap-1 opacity-60">
                                              <Lock className="h-3 w-3" /> Lucro por KM: (Premium)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {(l as any).total_minutes != null && (
                                    <>
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                                        <Clock className="h-3.5 w-3.5" />
                                        Tempo trabalhado: {formatMinutes((l as any).total_minutes)}
                                      </div>
                                      {(l as any).earning_per_hour != null && (
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                          <TrendingUp className="h-3.5 w-3.5" />
                                          {isPremium(user) ? (
                                            `Ganho por hora: ${formatCurrency((l as any).earning_per_hour)}/h`
                                          ) : (
                                            <span className="flex items-center gap-1 opacity-60">
                                              <Lock className="h-3 w-3" /> Ganho por hora: (Premium)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {l.observacao && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                                      Obs: {l.observacao}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {visibleLancamentos.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                Nenhum lançamento encontrado para este período.
              </div>
            ) : (
              visibleLancamentos.map((l) => {
                const isMultiple = l.categoria_id === 'multiple';
                const groupItems = isMultiple ? lancamentos.filter(item => item.group_id === l.group_id) : [];
                const isExpanded = expandedId === l.id;

                return (
                  <div 
                    key={l.id} 
                    className={cn(
                      "p-4 active:bg-gray-50 dark:active:bg-gray-800/50 transition-colors cursor-pointer",
                      isExpanded && "bg-gray-50 dark:bg-gray-800/40"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : l.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          l.tipo === 'receita' ? "bg-[#10B981]" : 
                          l.tipo === 'pessoal' ? "bg-blue-500" :
                          "bg-[#EF4444]"
                        )} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {isMultiple ? (
                              <span className="text-amber-600 dark:text-amber-400">Múltipla ({groupItems.length})</span>
                            ) : (
                              l.categorias?.nome || 'N/A'
                            )}
                            {l.fuel_type && (
                              <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                {l.fuel_type}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                            <span>{format(parseLocalDate(l.data), 'dd MMM yyyy', { locale: ptBR })}</span>
                            {l.vehicles && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Car className="h-2.5 w-2.5" />
                                  {l.vehicles.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={cn(
                          "text-sm font-bold",
                          l.tipo === 'receita' ? "text-[#059568] dark:text-[#10B981]" : 
                          l.tipo === 'pessoal' ? "text-blue-500 dark:text-blue-400 opacity-80" :
                          "text-[#EF4444] dark:text-[#F87171]"
                        )}>
                          {l.tipo === 'receita' ? '+' : l.tipo === 'pessoal' ? 'ℹ ' : '-'}{formatCurrency(l.valor)}
                        </p>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-200 space-y-4">
                        {isMultiple && (
                          <div className="space-y-2">
                            {groupItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{item.categorias?.nome}</span>
                                <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100">{formatCurrency(item.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {l.km_rodados != null && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                              <TrendingUp className="h-3 w-3" />
                              {l.km_rodados} KM rodados
                            </div>
                            {l.km_rodados > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(Number(l.valor) / l.km_rodados)}/km
                              </div>
                            )}
                          </div>
                        )}

                        {(l as any).total_minutes != null && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                              <Clock className="h-3 w-3" />
                              {formatMinutes((l as any).total_minutes)} trab.
                            </div>
                            {(l as any).earning_per_hour != null && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                <TrendingUp className="h-3 w-3" />
                                {formatCurrency((l as any).earning_per_hour)}/h
                              </div>
                            )}
                          </div>
                        )}

                        {l.observacao && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{l.observacao}"</p>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(l); }}
                            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmDelete(l.id); }}
                            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {hasMore && (
            <div className="p-6 border-t border-gray-50 dark:border-gray-800 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100"
              >
                Carregar mais lançamentos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita.
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

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        featureName={premiumFeatureName}
        user={user}
      />
    </div>
  );
}
