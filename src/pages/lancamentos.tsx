import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { cn, formatCurrency, formatCurrencyInput, parseCurrency, parseLocalDate, isPremium, isPremiumFull, compressImage } from '@/lib/utils';
import { Categoria, Lancamento, TipoLancamento, Vehicle, User, FuelType } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Car, Plus, ChevronUp, Filter, Search, ChevronLeft, ChevronRight, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Lock } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFuelAutoFill } from '@/hooks/useFuelAutoFill';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { PremiumModal } from '@/components/premium-modal';

interface LancamentosProps {
  categorias: Categoria[];
  lancamentos: Lancamento[];
  vehicles: Vehicle[];
  refetch: () => void;
  user: User;
  forceOpenForm?: boolean;
  onFormClose?: () => void;
}

interface LancamentoItem {
  categoriaId: string;
  valorStr: string;
}

export function Lancamentos({ categorias, lancamentos, vehicles, refetch, user, forceOpenForm, onFormClose }: LancamentosProps) {
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [items, setItems] = useState<LancamentoItem[]>([{ categoriaId: '', valorStr: '' }]);
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');
  
  // Vehicle fields
  const [vehicleId, setVehicleId] = useState('');
  const useVehicle = vehicleId !== '';
  const [odometer, setOdometer] = useState('');
  const [odometroReceita, setOdometroReceita] = useState('');
  const [fuelPricePerLiterStr, setFuelPricePerLiterStr] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [isFullTank, setIsFullTank] = useState(true);

  // Auto-fill states
  const [isOdometerManuallyEdited, setIsOdometerManuallyEdited] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  // History Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'receita' | 'despesa'>('all');
  const [filterCategoriaId, setFilterCategoriaId] = useState('all');
  const [filterVehicleId, setFilterVehicleId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

    if (items.some(item => !item.categoriaId || !item.valorStr) || !data) {
      setErrorMsg('Preencha todos os campos de categoria e valor.');
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

    // Duplicate category check
    const categoryIds = items.map(i => i.categoriaId);
    if (new Set(categoryIds).size !== categoryIds.length) {
      setErrorMsg('Não é permitido repetir a mesma categoria no mesmo lançamento.');
      return;
    }

    const totalValorNum = totalValor;
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
      
      // Busca o maior odômetro absoluto já registrado para este veículo
      const allOdos = lancamentos
        .filter(l => l.vehicle_id === vehicleId && (l.odometer || l.odometro_receita))
        .map(l => l.odometro_receita || l.odometer || 0);
      
      const lastOdo = allOdos.length > 0 ? Math.max(...allOdos) : (vehicle?.initial_odometer || 0);

      if (newOdo <= lastOdo && !editingId) {
        setErrorMsg(`O odômetro atual (${newOdo}) deve ser maior que o último registrado (${lastOdo}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const groupId = items.length > 1 ? crypto.randomUUID() : null;
      
      let kmRodados = null;
      let odoReceitaNum = odometroReceita ? Number(odometroReceita) : null;
      
      if (tipo === 'receita' && odoReceitaNum && useVehicle) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const launchDateStr = data;
        const registrationDateStr = vehicle ? format(new Date(vehicle.created_at), 'yyyy-MM-dd') : null;

        let lastOdoRef = null;

        if (vehicle && registrationDateStr) {
          const isSameDayAsRegistration = launchDateStr === registrationDateStr;

          if (isSameDayAsRegistration) {
            // Se for o mesmo dia do cadastro, busca o último do mesmo dia (ou o inicial)
            const sameDayOdos = lancamentos
              .filter(l => l.vehicle_id === vehicleId && l.data === launchDateStr && (l.odometer || l.odometro_receita))
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            if (sameDayOdos.length > 0) {
              lastOdoRef = sameDayOdos[0].odometro_receita || sameDayOdos[0].odometer;
            } else {
              lastOdoRef = vehicle.initial_odometer;
            }
          } else {
            // Se for dia posterior, busca o último de dias ANTERIORES
            const previousDayOdos = lancamentos
              .filter(l => l.vehicle_id === vehicleId && l.data < launchDateStr && (l.odometer || l.odometro_receita))
              .sort((a, b) => {
                const dateA = parseLocalDate(a.data).getTime();
                const dateB = parseLocalDate(b.data).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            
            if (previousDayOdos.length > 0) {
              lastOdoRef = previousDayOdos[0].odometro_receita || previousDayOdos[0].odometer;
            } else {
              lastOdoRef = vehicle.initial_odometer;
            }
          }
        }

        if (lastOdoRef !== null && odoReceitaNum) {
          kmRodados = odoReceitaNum - lastOdoRef;
        }
      }

      const payloads = items.map((item) => {
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

      if (editingId) {
        const original = lancamentos.find(l => l.id === editingId);
        if (original?.group_id) {
          await supabase.from('lancamentos').delete().eq('group_id', original.group_id);
        } else {
          await supabase.from('lancamentos').delete().eq('id', editingId);
        }
        const { error } = await supabase.from('lancamentos').insert(payloads);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lancamentos').insert(payloads);
        if (error) throw error;
      }

      setTipo('despesa');
      setItems([{ categoriaId: '', valorStr: '' }]);
      setData(format(new Date(), 'yyyy-MM-dd'));
      setObservacao('');
      setVehicleId('');
      setOdometer('');
      setOdometroReceita('');
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
        const { error } = await supabase.from('lancamentos').delete().eq('group_id', lancamento.group_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lancamentos').delete().eq('id', deletingId);
        if (error) throw error;
      }
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir lançamento.');
    }
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

  const groupedLancamentos = React.useMemo(() => {
    const allGroups: { [key: string]: Lancamento[] } = {};
    lancamentos.forEach(l => {
      if (l.group_id) {
        if (!allGroups[l.group_id]) allGroups[l.group_id] = [];
        allGroups[l.group_id].push(l);
      }
    });

    const processedGroups = new Set<string>();
    const result: Lancamento[] = [];

    filteredLancamentos.forEach(l => {
      if (l.group_id) {
        if (processedGroups.has(l.group_id)) return;
        
        const group = allGroups[l.group_id];
        // Encontra o item que contém os dados de odômetro/km prioritariamente
        const mainItem = group.find(item => item.km_rodados != null) || 
                         group.find(item => item.odometro_receita != null) || 
                         group[0];
        const total = group.reduce((acc, curr) => acc + Number(curr.valor), 0);
        
        result.push({
          ...mainItem,
          valor: total,
          categoria_id: 'multiple',
        });
        processedGroups.add(l.group_id);
      } else {
        result.push(l);
      }
    });

    return result.sort((a, b) => {
      const dateA = parseLocalDate(a.data).getTime();
      const dateB = parseLocalDate(b.data).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredLancamentos, lancamentos]);

  const monthSummary = React.useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    filteredLancamentos.forEach(l => {
      if (l.tipo === 'receita') receitas += Number(l.valor);
      else despesas += Number(l.valor);
    });
    return { receitas, despesas, saldo: receitas - despesas };
  }, [filteredLancamentos]);

  const visibleLancamentos = groupedLancamentos.slice(0, visibleCount);
  const hasMore = visibleCount < groupedLancamentos.length;

  const hasTransactions = lancamentos.length > 0;

  return (
    <div className="space-y-6">
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
      <div className="hidden sm:grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Receitas</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(monthSummary.receitas)}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Despesas</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(monthSummary.despesas)}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl",
              monthSummary.saldo >= 0 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-red-50 dark:bg-red-900/20"
            )}>
              <DollarSign className={cn(
                "h-5 w-5",
                monthSummary.saldo >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Saldo do Mês</p>
              <h3 className={cn(
                "text-lg font-bold",
                monthSummary.saldo >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(monthSummary.saldo)}
              </h3>
            </div>
          </CardContent>
        </Card>
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
              <CustomSelect 
                value={tipo} 
                onChange={(val) => setTipo(val as TipoLancamento)}
                options={[
                  { value: 'despesa', label: 'Despesa' },
                  { value: 'receita', label: 'Receita' }
                ]}
              />
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Itens do Lançamento</label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Adicionar Item
              </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 relative group">
                <div className="sm:col-span-6 space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Categoria</label>
                  <CustomSelect 
                    value={item.categoriaId} 
                    onChange={(val) => updateItem(index, 'categoriaId', val)}
                    options={filteredCategorias.map(c => ({ value: c.id, label: c.nome }))}
                    placeholder="Selecione..."
                  />
                </div>
                <div className="sm:col-span-5 space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Valor</label>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo (Opcional)</label>
              <CustomSelect 
                value={vehicleId} 
                onChange={setVehicleId}
                options={[
                  { value: '', label: 'Nenhum veículo' },
                  ...vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
                ]}
              />
            </div>

            {useVehicle && tipo === 'receita' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 space-y-2">
                <label className="text-sm font-medium text-blue-900 dark:text-blue-100">Odômetro Atual (KM) - Opcional</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 50100"
                  value={odometroReceita}
                  onChange={(e) => setOdometroReceita(e.target.value)}
                  className="bg-white dark:bg-gray-900"
                />
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Usado para calcular a quilometragem rodada no dia.</p>
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

                  {isCombustivel() && (
                    <>
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
                          required={useVehicle && tipo === 'despesa' && isCombustivel()}
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
                      <div className="space-y-2 md:col-span-2 flex items-center pt-2">
                        <input
                          type="checkbox"
                          id="isFullTank"
                          checked={isFullTank}
                          onChange={(e) => setIsFullTank(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                        />
                        <label htmlFor="isFullTank" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                          Tanque Cheio? (Usado para calcular a média de consumo)
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observação</label>
              <Input
                type="text"
                placeholder="Detalhes do lançamento..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end pt-4 gap-2">
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
              <Button type="submit" disabled={loading || filteredCategorias.length === 0} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706] text-white">
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
                                  : 'bg-red-50 dark:bg-[#EF4444]/10 text-[#EF4444] dark:text-[#F87171]'
                              }`}
                            >
                              {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
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
                              l.tipo === 'receita' ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'
                            }`}
                          >
                            {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
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
                                          Lucro por KM: {formatCurrency(Number(l.valor) / l.km_rodados)}/km
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
                          l.tipo === 'receita' ? "bg-[#10B981]" : "bg-[#EF4444]"
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
                          l.tipo === 'receita' ? "text-[#059568] dark:text-[#10B981]" : "text-[#EF4444] dark:text-[#F87171]"
                        )}>
                          {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
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
