import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { CustomSelect } from '@/components/ui/custom-select';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseLocalDate, isPremium } from '@/lib/utils';
import { Categoria, Lancamento, Vehicle, User, WorkShift } from '@/types';
import { format, isWithinInterval, startOfMonth, endOfMonth, subMonths, addMonths, eachMonthOfInterval, differenceInDays, addDays, isSameDay, startOfYear, endOfYear, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Filter, TrendingUp, TrendingDown, DollarSign, Wallet, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, Download, FileSpreadsheet, FileJson, MessageSquare, Upload, AlertCircle, CheckCircle2, Clock, Lock, Car } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { PremiumModal } from '@/components/premium-modal';
import { useFeatures } from '@/contexts/FeatureContext';

interface RelatoriosProps {
  lancamentos: Lancamento[];
  vehicles: Vehicle[];
  categorias: Categoria[];
  workShifts: WorkShift[];
  user: User;
  refetch: () => void;
}

export function Relatorios({ lancamentos, vehicles, categorias, workShifts, user, refetch }: RelatoriosProps) {
  const { preferences } = useFeatures();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');
  const [filterType, setFilterType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [chartMonthsFilter, setChartMonthsFilter] = useState<number>(6);
  const [showChartFilter, setShowChartFilter] = useState(false);
  const [exportNotes, setExportNotes] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShiftsStatsOpen, setIsShiftsStatsOpen] = useState(true);
  const [isFuelSummaryOpen, setIsFuelSummaryOpen] = useState(true);
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(true);
  const [heatmapDate, setHeatmapDate] = useState(new Date());
  const [heatmapVehicleId, setHeatmapVehicleId] = useState<string>('all');
  const [exportLoading, setExportLoading] = useState(false);

  const heatmapPersonalSummary = useMemo(() => {
    const start = startOfMonth(heatmapDate);
    const end = endOfMonth(heatmapDate);
    
    const personalLancamentos = lancamentos.filter(l => {
      if (l.tipo !== 'pessoal') return false;
      const d = parseLocalDate(l.data);
      const matchesDate = isWithinInterval(d, { start, end });
      const matchesVehicle = heatmapVehicleId === 'all' || l.vehicle_id === heatmapVehicleId;
      return matchesDate && matchesVehicle;
    });

    const totalKm = personalLancamentos.reduce((acc, l) => acc + (l.km_rodados || 0), 0);
    const totalCost = personalLancamentos.reduce((acc, l) => acc + Number(l.valor), 0);

    return { totalKm, totalCost };
  }, [heatmapDate, heatmapVehicleId, lancamentos]);
  const [importLoading, setImportLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const chartRef = useRef<HTMLDivElement>(null);
  const reportChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setChartMonthsFilter(3);
    }
  }, []);

  const filteredLancamentos = useMemo(() => {
    let start: Date;
    let end: Date;

    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      const filterDate = new Date(Number(year), Number(month) - 1);
      
      if (!isPremium(user)) {
        const now = new Date();
        const isCurrentMonth = filterDate.getMonth() === now.getMonth() && filterDate.getFullYear() === now.getFullYear();
        if (!isCurrentMonth) {
          return [];
        }
      }

      start = startOfMonth(filterDate);
      end = endOfMonth(filterDate);
    } else if (filterType === 'year') {
      if (!isPremium(user)) return [];
      start = startOfYear(new Date(Number(selectedYear), 0));
      end = endOfYear(new Date(Number(selectedYear), 0));
    } else {
      if (!isPremium(user)) return [];
      start = parseLocalDate(startDate);
      end = parseLocalDate(endDate);
    }

    return lancamentos.filter((l) => {
      const data = parseLocalDate(l.data);
      const matchesDate = isWithinInterval(data, { start, end });
      const matchesVehicle = selectedVehicleId === 'all' || l.vehicle_id === selectedVehicleId;
      return matchesDate && matchesVehicle;
    });
  }, [lancamentos, filterType, selectedMonth, startDate, endDate, selectedVehicleId, user]);

  const stats = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    let saldoAcumulado = 0;
    const porCategoria: Record<string, { nome: string; valor: number; tipo: string }> = {};
    const porVeiculo: Record<string, { nome: string; placa: string; receitas: number; despesas: number; saldo: number; totalMinutes: number }> = {};
    const porCombustivel: Record<string, { valor: number; litros: number }> = {};

    // Calculate accumulated balance up to the end date of the filter
    let endFilterDate: Date;
    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      endFilterDate = endOfMonth(new Date(Number(year), Number(month) - 1));
    } else if (filterType === 'year') {
      endFilterDate = endOfYear(new Date(Number(selectedYear), 0));
    } else {
      endFilterDate = parseLocalDate(endDate);
    }

    lancamentos.forEach((l) => {
      const data = parseLocalDate(l.data);
      const matchesVehicle = selectedVehicleId === 'all' || l.vehicle_id === selectedVehicleId;
      
      if (data <= endFilterDate && matchesVehicle) {
        const valor = Number(l.valor);
        if (l.tipo === 'receita') saldoAcumulado += valor;
        else if (l.tipo === 'despesa') saldoAcumulado -= valor;
      }
    });

    filteredLancamentos.forEach((l) => {
      const valor = Number(l.valor);
      if (l.tipo === 'receita') {
        receitas += valor;
      } else if (l.tipo === 'despesa') {
        despesas += valor;
      }

      if (l.categorias) {
        if (!porCategoria[l.categorias.id]) {
          porCategoria[l.categorias.id] = {
            nome: l.categorias.nome,
            valor: 0,
            tipo: l.tipo,
          };
        }
        porCategoria[l.categorias.id].valor += valor;
      }

      if (l.vehicle_id && l.vehicles) {
        if (!porVeiculo[l.vehicle_id]) {
          porVeiculo[l.vehicle_id] = {
            nome: l.vehicles.name,
            placa: l.vehicles.plate || '',
            receitas: 0,
            despesas: 0,
            saldo: 0,
            totalMinutes: 0
          };
        }
        if (l.tipo === 'receita') {
          porVeiculo[l.vehicle_id].receitas += valor;
          porVeiculo[l.vehicle_id].saldo += valor;
        } else if (l.tipo === 'despesa') {
          porVeiculo[l.vehicle_id].despesas += valor;
          porVeiculo[l.vehicle_id].saldo -= valor;
        }
      }

      if (l.tipo === 'despesa' && l.fuel_liters && l.fuel_liters > 0) {
        const fuelType = l.fuel_type || 'Não especificado';
        if (!porCombustivel[fuelType]) {
          porCombustivel[fuelType] = { valor: 0, litros: 0 };
        }
        porCombustivel[fuelType].valor += valor;
        porCombustivel[fuelType].litros += Number(l.fuel_liters);
      }
    });

    // Add minutes from work shifts to porVeiculo
    workShifts.forEach(s => {
      const data = parseLocalDate(s.date);
      let startRange: Date;
      let endRange: Date;

      if (filterType === 'month') {
        const [year, month] = selectedMonth.split('-');
        startRange = startOfMonth(new Date(Number(year), Number(month) - 1));
        endRange = endOfMonth(new Date(Number(year), Number(month) - 1));
      } else if (filterType === 'year') {
        startRange = startOfYear(new Date(Number(selectedYear), 0));
        endRange = endOfYear(new Date(Number(selectedYear), 0));
      } else {
        startRange = parseLocalDate(startDate);
        endRange = parseLocalDate(endDate);
      }

      if (isWithinInterval(data, { start: startRange, end: endRange }) && s.vehicle_id && porVeiculo[s.vehicle_id] && s.start_time && s.end_time) {
        const startT = new Date(`2000-01-01T${s.start_time}`);
        const endT = new Date(`2000-01-01T${s.end_time}`);
        let minutes = (endT.getTime() - startT.getTime()) / (1000 * 60);
        if (minutes < 0) minutes += 24 * 60;
        porVeiculo[s.vehicle_id].totalMinutes += minutes;
      }
    });

    return {
      receitas,
      despesas,
      lucroLiquido: receitas - despesas,
      saldoAcumulado,
      pessoalTotal: filteredLancamentos.filter(l => l.tipo === 'pessoal').reduce((acc, l) => acc + Number(l.valor), 0),
      pessoalKmTotal: filteredLancamentos.filter(l => l.tipo === 'pessoal').reduce((acc, l) => acc + (l.km_rodados || 0), 0),
      porCategoria: Object.values(porCategoria).sort((a, b) => b.valor - a.valor),
      porCategoriaRaw: porCategoria,
      porVeiculo: Object.values(porVeiculo).map(v => ({
        ...v,
        ganhoPorHora: v.totalMinutes > 0 ? v.receitas / (v.totalMinutes / 60) : 0
      })).sort((a, b) => b.saldo - a.saldo),
      porCombustivel: Object.entries(porCombustivel).map(([tipo, data]) => ({ tipo, ...data })).sort((a, b) => b.valor - a.valor)
    };
  }, [filteredLancamentos, lancamentos, filterType, selectedMonth, selectedYear, endDate, selectedVehicleId, workShifts]);

  const shiftStats = useMemo(() => {
    let start: Date;
    let end: Date;

    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      start = startOfMonth(new Date(Number(year), Number(month) - 1));
      end = endOfMonth(new Date(Number(year), Number(month) - 1));
    } else if (filterType === 'year') {
      start = startOfYear(new Date(Number(selectedYear), 0));
      end = endOfYear(new Date(Number(selectedYear), 0));
    } else {
      start = parseLocalDate(startDate);
      end = parseLocalDate(endDate);
    }

    const filteredShifts = workShifts.filter(s => {
      const data = parseLocalDate(s.date);
      const matchesVehicle = selectedVehicleId === 'all' || s.vehicle_id === selectedVehicleId;
      return isWithinInterval(data, { start, end }) && matchesVehicle;
    });

    const workShiftsInRange = filteredShifts.filter(s => s.type === 'work');
    const workDates = new Set(workShiftsInRange.map(s => s.date));
    const shiftGroupIds = new Set(workShiftsInRange.map(s => s.group_id).filter(Boolean));

    let totalMinutes = 0;
    let totalOdometer = 0;
    let totalGoal = 0;

    workShiftsInRange.forEach(shift => {
      if (shift.start_time && shift.end_time) {
        const startT = new Date(`2000-01-01T${shift.start_time}`);
        const endT = new Date(`2000-01-01T${shift.end_time}`);
        let minutes = (endT.getTime() - startT.getTime()) / (1000 * 60);
        if (minutes < 0) {
          minutes += 24 * 60; // Crossed midnight
        }
        totalMinutes += minutes;
      }
      
      if (shift.start_odometer && shift.end_odometer) {
        totalOdometer += (Number(shift.end_odometer) - Number(shift.start_odometer));
      } else if (shift.odometer) {
        totalOdometer += Number(shift.odometer);
      }

      if (shift.goal) {
        totalGoal += Number(shift.goal);
      }
    });

    const totalHours = totalMinutes / 60;
    
    // Estimate fuel cost based on average fuel price from lancamentos
    let totalLiters = 0;
    let totalFuelCost = 0;
    let receitasTurno = 0;
    let despesasTurno = 0;

    lancamentos.forEach(l => {
      const matchesVehicle = selectedVehicleId === 'all' || l.vehicle_id === selectedVehicleId;
      if (!matchesVehicle) return;

      // Check if this lancamento is linked to a shift in our range
      const isLinkedByGroup = l.group_id && shiftGroupIds.has(l.group_id);
      const isLinkedToShift = l.shift_id && workShiftsInRange.some(s => s.id === l.shift_id);
      const lDateFormatted = format(parseLocalDate(l.data), 'yyyy-MM-dd');
      const isSameDayAsShift = workDates.has(lDateFormatted);

      if (isLinkedByGroup || isLinkedToShift || isSameDayAsShift) {
        if (l.tipo === 'receita') receitasTurno += Number(l.valor);
        if (l.tipo === 'despesa') despesasTurno += Number(l.valor);
      }

      if (l.tipo === 'despesa' && l.fuel_liters && l.valor) {
        totalLiters += Number(l.fuel_liters);
        totalFuelCost += Number(l.valor);
      }
    });

    const averageFuelPrice = totalLiters > 0 ? totalFuelCost / totalLiters : 5.50;
    const averageKmL = 10; // Default fallback if we can't calculate precisely
    
    const estimatedFuelCost = (totalOdometer / averageKmL) * averageFuelPrice;
    
    const lucroReal = receitasTurno - despesasTurno;
    
    return {
      totalHours,
      totalOdometer,
      totalGoal,
      receitasTurno,
      estimatedFuelCost,
      ganhoPorHora: totalHours > 0 ? receitasTurno / totalHours : 0,
      lucroPorHora: totalHours > 0 ? lucroReal / totalHours : 0,
      ganhoPorKm: totalOdometer > 0 ? receitasTurno / totalOdometer : 0,
    };
  }, [workShifts, filterType, selectedMonth, selectedYear, startDate, endDate, selectedVehicleId, lancamentos]);

  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = chartMonthsFilter - 1; i >= 0; i--) {
      const targetMonth = subMonths(now, i);
      const start = startOfMonth(targetMonth);
      const end = endOfMonth(targetMonth);
      
      let receitas = 0;
      let despesas = 0;

      lancamentos.forEach((l) => {
        const lDate = parseLocalDate(l.data);
        const matchesVehicle = selectedVehicleId === 'all' || l.vehicle_id === selectedVehicleId;
        
        if (isWithinInterval(lDate, { start, end }) && matchesVehicle) {
          if (l.tipo === 'receita') receitas += Number(l.valor);
          else despesas += Number(l.valor);
        }
      });

      data.push({
        name: format(targetMonth, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        Receitas: receitas,
        Despesas: despesas,
      });
    }
    return data;
  }, [lancamentos, chartMonthsFilter, selectedVehicleId]);

  const reportChartData = useMemo(() => {
    let start: Date;
    let end: Date;
    
    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      start = startOfMonth(new Date(Number(year), Number(month) - 1));
      end = endOfMonth(new Date(Number(year), Number(month) - 1));
    } else if (filterType === 'year') {
      start = startOfYear(new Date(Number(selectedYear), 0));
      end = endOfYear(new Date(Number(selectedYear), 0));
    } else {
      start = parseLocalDate(startDate);
      end = parseLocalDate(endDate);
    }

    const now = new Date();
    // Se o período selecionado inclui o dia de hoje, usamos o dia de hoje para decidir a granularidade (ex: 11 dias de Março)
    const isCurrentPeriod = isWithinInterval(now, { start, end });
    const effectiveEndForGranularity = isCurrentPeriod ? now : end;
    const daysCount = differenceInDays(effectiveEndForGranularity, start) + 1;
    
    const data: any[] = [];

    if (daysCount <= 6) {
      // Daily
      for (let i = 0; i < daysCount; i++) {
        const targetDate = addDays(start, i);
        let receitas = 0;
        let despesas = 0;
        filteredLancamentos.forEach(l => {
          if (isSameDay(parseLocalDate(l.data), targetDate)) {
            if (l.tipo === 'receita') receitas += Number(l.valor);
            else despesas += Number(l.valor);
          }
        });
        data.push({
          name: format(targetDate, 'dd/MM'),
          Receitas: receitas,
          Despesas: despesas
        });
      }
    } else if (daysCount <= 20) {
      // Weekly
      const weeksCount = Math.ceil(daysCount / 7);
      for (let i = 0; i < weeksCount; i++) {
        const weekStart = addDays(start, i * 7);
        const weekEnd = addDays(weekStart, 6) > end ? end : addDays(weekStart, 6);
        let receitas = 0;
        let despesas = 0;
        filteredLancamentos.forEach(l => {
          const lDate = parseLocalDate(l.data);
          if (isWithinInterval(lDate, { start: weekStart, end: weekEnd })) {
            if (l.tipo === 'receita') receitas += Number(l.valor);
            else despesas += Number(l.valor);
          }
        });
        data.push({
          name: `Semana ${i + 1}`,
          Receitas: receitas,
          Despesas: despesas
        });
      }
    } else {
      // Fortnightly (Quinzena)
      const midPoint = addDays(start, 14);
      
      let r1 = 0, d1 = 0, r2 = 0, d2 = 0;
      filteredLancamentos.forEach(l => {
        const lDate = parseLocalDate(l.data);
        if (lDate <= midPoint) {
          if (l.tipo === 'receita') r1 += Number(l.valor);
          else d1 += Number(l.valor);
        } else {
          if (l.tipo === 'receita') r2 += Number(l.valor);
          else d2 += Number(l.valor);
        }
      });
      
      data.push({ name: '1ª Quinzena', Receitas: r1, Despesas: d1 });
      data.push({ name: '2ª Quinzena', Receitas: r2, Despesas: d2 });
    }

    return data;
  }, [filteredLancamentos, filterType, selectedMonth, startDate, endDate]);

  const productivityChartData = useMemo(() => {
    let start: Date;
    let end: Date;
    
    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      start = startOfMonth(new Date(Number(year), Number(month) - 1));
      end = endOfMonth(new Date(Number(year), Number(month) - 1));
    } else if (filterType === 'year') {
      start = startOfYear(new Date(Number(selectedYear), 0));
      end = endOfYear(new Date(Number(selectedYear), 0));
    } else {
      start = parseLocalDate(startDate);
      end = parseLocalDate(endDate);
    }

    const now = new Date();
    const isCurrentPeriod = isWithinInterval(now, { start, end });
    const effectiveEnd = isCurrentPeriod ? now : end;
    const daysCount = differenceInDays(effectiveEnd, start) + 1;
    
    const data: any[] = [];

    if (daysCount <= 31) {
      // Daily productivity
      for (let i = 0; i < daysCount; i++) {
        const targetDate = addDays(start, i);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        
        let minutes = 0;
        workShifts.forEach(s => {
          if (s.date === targetDateStr && s.type === 'work' && s.start_time && s.end_time) {
            const startT = new Date(`2000-01-01T${s.start_time}`);
            const endT = new Date(`2000-01-01T${s.end_time}`);
            let diff = (endT.getTime() - startT.getTime()) / (1000 * 60);
            if (diff < 0) diff += 24 * 60;
            minutes += diff;
          }
        });

        data.push({
          name: format(targetDate, 'dd/MM'),
          'Horas': Number((minutes / 60).toFixed(2))
        });
      }
    } else {
      // Monthly productivity for year view
      const months = eachMonthOfInterval({ start, end });
      months.forEach(m => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        
        let minutes = 0;
        workShifts.forEach(s => {
          const sDate = parseLocalDate(s.date);
          if (isWithinInterval(sDate, { start: mStart, end: mEnd }) && s.type === 'work' && s.start_time && s.end_time) {
            const startT = new Date(`2000-01-01T${s.start_time}`);
            const endT = new Date(`2000-01-01T${s.end_time}`);
            let diff = (endT.getTime() - startT.getTime()) / (1000 * 60);
            if (diff < 0) diff += 24 * 60;
            minutes += diff;
          }
        });

        data.push({
          name: format(m, 'MMM', { locale: ptBR }),
          'Horas': Number((minutes / 60).toFixed(2))
        });
      });
    }

    return data;
  }, [workShifts, filterType, selectedMonth, selectedYear, startDate, endDate]);

  const nextHeatmapMonth = () => setHeatmapDate(addMonths(heatmapDate, 1));
  const prevHeatmapMonth = () => setHeatmapDate(subMonths(heatmapDate, 1));

  const heatmapData = useMemo(() => {
    const monthStart = startOfMonth(heatmapDate);
    const monthEnd = endOfMonth(heatmapDate);
    
    // Calendar starts on Monday
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    const weeks: { name: string; days: { date: Date; profit: number; isCurrentMonth: boolean }[] }[] = [];
    let currentWeek: { date: Date; profit: number; isCurrentMonth: boolean }[] = [];
    
    allDays.forEach((day, index) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Calculate profit for this day
      const dayReceitas = lancamentos
        .filter(l => {
          const matchesDate = l.data === dateStr;
          const matchesVehicle = heatmapVehicleId === 'all' || l.vehicle_id === heatmapVehicleId;
          return matchesDate && matchesVehicle && l.tipo === 'receita';
        })
        .reduce((sum, l) => sum + Number(l.valor), 0);
      
      const dayDespesas = lancamentos
        .filter(l => {
          const matchesDate = l.data === dateStr;
          const matchesVehicle = heatmapVehicleId === 'all' || l.vehicle_id === heatmapVehicleId;
          return matchesDate && matchesVehicle && l.tipo === 'despesa';
        })
        .reduce((sum, l) => sum + Number(l.valor), 0);
      
      const profit = dayReceitas - dayDespesas;
      
      currentWeek.push({
        date: day,
        profit,
        isCurrentMonth: day.getMonth() === heatmapDate.getMonth()
      });
      
      if (currentWeek.length === 7) {
        weeks.push({
          name: `Semana ${weeks.length + 1}`,
          days: currentWeek
        });
        currentWeek = [];
      }
    });

    return { weeks, monthLabel: format(heatmapDate, 'MMMM yyyy', { locale: ptBR }) };
  }, [heatmapDate, lancamentos, heatmapVehicleId]);

  const exportToPDF = async () => {
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const { default: html2canvas } = await import('html2canvas');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header
      doc.setFillColor(245, 158, 11); // #F59E0B
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // User Photo as Logo in PDF
      if (user.foto_url) {
        try {
          const img = new Image();
          img.src = user.foto_url;
          img.crossOrigin = "Anonymous";
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          doc.addImage(img, 'JPEG', 15, 7, 30, 30);
        } catch (e) {
          console.error("Error adding image to PDF", e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('Atlas Financeiro', 55, 22);
      doc.setFontSize(12);
      doc.text(`Relatório de: ${user.nome || user.email}`, 55, 32);
      
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      const periodText = filterType === 'month' 
        ? `Período: ${format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}`
        : `Período: ${format(parseLocalDate(startDate), 'dd/MM/yyyy')} até ${format(parseLocalDate(endDate), 'dd/MM/yyyy')}`;
      
      doc.text(periodText, 15, 55);
      
      let currentY = 60;
      if (selectedVehicleId !== 'all') {
        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
        doc.text(`Veículo: ${vehicle?.name} (${vehicle?.plate})`, 15, currentY);
        currentY += 5;
      }

      // Add Export Notes if any
      if (exportNotes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const splitNotes = doc.splitTextToSize(`Observações: ${exportNotes}`, pageWidth - 30);
        doc.text(splitNotes, 15, currentY + 5);
        currentY += (splitNotes.length * 5) + 10;
      } else {
        currentY += 10;
      }

      // Add Chart to PDF FIRST
      if (reportChartRef.current) {
        try {
          const canvas = await html2canvas(reportChartRef.current, {
            scale: 3, // Higher scale for better quality (less "print" look)
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            onclone: (clonedDoc) => {
              // Force a clean white background for the chart capture
              const chartContainer = clonedDoc.getElementById('report-chart-container');
              if (chartContainer) {
                chartContainer.style.backgroundColor = '#ffffff';
                chartContainer.style.color = '#111827';
                chartContainer.style.padding = '20px';
                chartContainer.style.borderRadius = '0px';
                chartContainer.style.boxShadow = 'none';
              }
              
              // The html2canvas parser fails on oklch() in the CSS.
              const styleTags = clonedDoc.getElementsByTagName('style');
              for (let i = 0; i < styleTags.length; i++) {
                try {
                  styleTags[i].innerHTML = styleTags[i].innerHTML.replace(/oklch\([^)]+\)/g, '#71717a');
                } catch (e) {
                  console.warn("Could not sanitize style tag", e);
                }
              }
              
              const linkTags = clonedDoc.getElementsByTagName('link');
              for (let i = 0; i < linkTags.length; i++) {
                if (linkTags[i].rel === 'stylesheet') {
                  linkTags[i].remove();
                }
              }

              const elements = clonedDoc.getElementsByTagName('*');
              for (let i = 0; i < elements.length; i++) {
                const el = elements[i] as HTMLElement;
                
                // Force dark text and remove dark mode classes for the capture
                if (el.classList) {
                  el.classList.remove('dark');
                  el.classList.remove('dark:bg-gray-900');
                  el.classList.remove('dark:text-gray-400');
                  el.classList.remove('bg-white');
                  el.classList.remove('dark:bg-gray-800');
                }

                if (el.style) {
                  for (let j = 0; j < el.style.length; j++) {
                    const prop = el.style[j];
                    const val = el.style.getPropertyValue(prop);
                    if (val && val.includes('oklch')) {
                      el.style.setProperty(prop, '#71717a');
                    }
                  }
                }
              }
            }
          });
          const imgData = canvas.toDataURL('image/png');
          
          // Check if we need a new page for the chart
          if (currentY + 80 > pageHeight) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFontSize(14);
          doc.text('Comparativo do Período', 15, currentY);
          
          // Add a subtle border around the chart image
          doc.setDrawColor(240, 240, 240);
          doc.rect(15, currentY + 5, pageWidth - 30, 70);
          
          doc.addImage(imgData, 'PNG', 15, currentY + 5, pageWidth - 30, 70);
          currentY += 85;
        } catch (e) {
          console.error("Error adding chart to PDF", e);
        }
      }

      // Stats Table
      autoTable(doc, {
        startY: currentY,
        head: [['Resumo Financeiro', 'Valor']],
        body: [
          ['Total Receitas', formatCurrency(stats.receitas)],
          ['Total Despesas', formatCurrency(stats.despesas)],
          ['Saldo', formatCurrency(stats.lucroLiquido)],
          ['Saldo Acumulado', formatCurrency(stats.saldoAcumulado)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Category Summary Table
      doc.setFontSize(14);
      doc.setTextColor(55, 65, 81);
      doc.text('Resumo por Categoria', 15, currentY);
      
      const categoryData = stats.porCategoria.map(c => [
        c.nome,
        c.tipo === 'receita' ? 'Receita' : 'Despesa',
        formatCurrency(c.valor)
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Categoria', 'Tipo', 'Total']],
        body: categoryData,
        theme: 'grid',
        headStyles: { fillColor: [107, 114, 128] },
        columnStyles: {
          2: { halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.text[0] === 'Receita') {
              data.cell.styles.textColor = [5, 149, 104];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Vehicle Summary Table
      if (stats.porVeiculo.length > 0) {
        if (currentY + 40 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(55, 65, 81);
        doc.text('Resumo por Veículo', 15, currentY);
        
        const vehicleData = stats.porVeiculo.map(v => [
          v.nome + (v.placa ? ` (${v.placa})` : ''),
          formatCurrency(v.receitas),
          formatCurrency(v.despesas),
          formatCurrency(v.saldo),
          `${Math.floor(v.totalMinutes / 60)}h ${Math.round(v.totalMinutes % 60)}m`,
          formatCurrency(v.ganhoPorHora) + '/h'
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Veículo', 'Receitas', 'Despesas', 'Saldo', 'Tempo', 'Ganho/Hora']],
          body: vehicleData,
          theme: 'grid',
          headStyles: { fillColor: [107, 114, 128] },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              const rawValue = data.cell.raw as string;
              if (!rawValue.includes('-') && rawValue !== 'R$ 0,00') {
                data.cell.styles.textColor = [5, 149, 104];
              } else if (rawValue.includes('-')) {
                data.cell.styles.textColor = [239, 68, 68];
              }
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Transactions Table
      if (currentY + 40 > pageHeight) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.text('Detalhamento de Transações', 15, currentY);

      const tableData = filteredLancamentos.map(l => [
        format(parseLocalDate(l.data), 'dd/MM/yyyy'),
        l.observacao || '-',
        l.categorias?.nome || '-',
        l.vehicles?.name || '-',
        l.tipo === 'receita' ? 'RECEITA' : 'DESPESA',
        formatCurrency(Number(l.valor)),
        l.odometer || '-',
        l.is_full_tank ? 'tank full' : '',
        l.fuel_price_per_liter ? formatCurrency(Number(l.fuel_price_per_liter)) : '-'
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Data', 'Descrição', 'Categoria', 'Veículo', 'Tipo', 'Valor', 'KM', 'Tanque', 'R$/L']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] },
        columnStyles: {
          5: { halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            if (data.cell.text[0] === 'RECEITA') {
              data.cell.styles.textColor = [5, 149, 104];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
            }
          }
        }
      });

      // Footer with page numbers
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Atlas Financeiro`,
          15,
          pageHeight - 10
        );
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - 30,
          pageHeight - 10
        );
      }

      doc.save(`relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      setErrorMsg("Erro ao exportar PDF.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setErrorMsg('');
    
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          if (data.length === 0) {
            setErrorMsg('O arquivo está vazio.');
            setImportLoading(false);
            return;
          }

          const newLancamentos: any[] = [];
          let skippedRows = 0;
          
          for (const row of data) {
            // Try to map columns (handling both Portuguese and English common names)
            const dataStr = row['Data'] || row['date'] || row['Date'];
            const valorRaw = row['Valor'] || row['value'] || row['Amount'] || row['amount'];
            const tipoRaw = row['Tipo'] || row['type'] || row['Type'];
            const categoriaNome = row['Categoria'] || row['category'] || row['Category'];
            const observacao = row['Descrição'] || row['description'] || row['Description'] || row['Observação'] || row['observacao'];
            const veiculoNome = row['Veículo'] || row['vehicle'] || row['Vehicle'];
            const placa = row['Placa'] || row['plate'] || row['Plate'];

            if (!dataStr || !valorRaw || !tipoRaw) {
              skippedRows++;
              continue;
            }

            // Parse date
            let finalDate = dataStr;
            if (typeof dataStr === 'number') {
              // Excel date serial number
              const dateObj = XLSX.SSF.parse_date_code(dataStr);
              finalDate = format(new Date(dateObj.y, dateObj.m - 1, dateObj.d), 'yyyy-MM-dd');
            } else if (typeof dataStr === 'string' && dataStr.includes('/')) {
              const parts = dataStr.split('/');
              if (parts.length === 3) {
                // Assume dd/mm/yyyy
                finalDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            }

            // Parse valor
            let valor = 0;
            if (typeof valorRaw === 'string') {
              valor = parseFloat(valorRaw.replace(/[R$\s.]/g, '').replace(',', '.'));
            } else {
              valor = Number(valorRaw);
            }

            // Find category
            let catId = null;
            if (categoriaNome) {
              const cat = categorias.find(c => c.nome.toLowerCase() === categoriaNome.toLowerCase());
              if (cat) catId = cat.id;
            }
            
            // If no category found, use a default one based on type
            if (!catId) {
              const defaultCat = categorias.find(c => c.tipo === (tipoRaw.toLowerCase().includes('receita') ? 'receita' : 'despesa'));
              if (defaultCat) catId = defaultCat.id;
            }

            // Find vehicle
            let vId = null;
            if (veiculoNome || placa) {
              const vehicle = vehicles.find(v => 
                (veiculoNome && v.name.toLowerCase() === veiculoNome.toLowerCase()) || 
                (placa && v.plate && v.plate.toLowerCase() === placa.toLowerCase())
              );
              if (vehicle) vId = vehicle.id;
            }

            newLancamentos.push({
              user_id: user.id,
              tipo: tipoRaw.toLowerCase().includes('receita') ? 'receita' : 'despesa',
              categoria_id: catId,
              valor: valor,
              data: finalDate,
              observacao: (observacao || 'Importado via relatório').substring(0, 255),
              vehicle_id: vId,
              created_at: new Date().toISOString()
            });
          }

          if (newLancamentos.length > 0) {
            const { error } = await supabase.from('lancamentos').insert(newLancamentos);
            if (error) throw error;
            
            refetch();
            setIsImportModalOpen(false);
            alert(`${newLancamentos.length} lançamentos importados com sucesso!${skippedRows > 0 ? ` (${skippedRows} linhas ignoradas por falta de dados)` : ''}`);
          } else {
            setErrorMsg('Nenhum dado válido encontrado para importação.');
          }
        } catch (err: any) {
          setErrorMsg('Erro ao processar arquivo: ' + err.message);
        } finally {
          setImportLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      setErrorMsg('Erro ao ler arquivo: ' + error.message);
      setImportLoading(false);
    }
  };


  const exportToExcel = async (fileFormat: 'xlsx' | 'csv') => {
    setExportLoading(true);
    try {
      const XLSX = await import('xlsx');
      // Prepare data for Excel
      const data = filteredLancamentos.map(l => ({
        'Data': format(parseLocalDate(l.data), 'dd/MM/yyyy'),
        'Descrição': l.observacao || '-',
        'Categoria': l.categorias?.nome || (l.tipo === 'pessoal' ? 'Uso Pessoal' : '-'),
        'Tipo': l.tipo === 'receita' ? 'Receita' : l.tipo === 'despesa' ? 'Despesa' : 'Uso Pessoal',
        'Valor': Number(l.valor),
        'Veículo': l.vehicles?.name || '-',
        'Placa': l.vehicles?.plate || '-',
        'KM': l.odometer || '-',
        'Tanque Cheio': l.is_full_tank ? 'tank full' : '',
        'Valor por Litro': l.fuel_price_per_liter ? formatCurrency(Number(l.fuel_price_per_liter)) : '-'
      }));

      // Add summary sheet or rows
      const summary = [
        { 'Item': 'Total Receitas', 'Valor': stats.receitas },
        { 'Item': 'Total Despesas', 'Valor': stats.despesas },
        { 'Item': 'Saldo', 'Valor': stats.lucroLiquido },
        { 'Item': 'Saldo Acumulado', 'Valor': stats.saldoAcumulado },
        { 'Item': 'Uso Pessoal (Custo Estimado)', 'Valor': stats.pessoalTotal },
        { 'Item': 'Uso Pessoal (KM)', 'Valor': stats.pessoalKmTotal }
      ];

      const vehicleSummary = stats.porVeiculo.map(v => ({
        'Veículo': v.nome,
        'Placa': v.placa,
        'Receitas': v.receitas,
        'Despesas': v.despesas,
        'Saldo': v.saldo,
        'Tempo Trabalhado': `${Math.floor(v.totalMinutes / 60)}h ${Math.round(v.totalMinutes % 60)}m`,
        'Ganho por Hora': v.ganhoPorHora
      }));

      const wb = XLSX.utils.book_new();
      const wsTransactions = XLSX.utils.json_to_sheet(data);
      const wsSummary = XLSX.utils.json_to_sheet(summary);
      
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

      if (vehicleSummary.length > 0) {
        const wsVehicleSummary = XLSX.utils.json_to_sheet(vehicleSummary);
        XLSX.utils.book_append_sheet(wb, wsVehicleSummary, 'Resumo por Veículo');
      }

      if (fileFormat === 'xlsx') {
        XLSX.writeFile(wb, `atlas-financeiro-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      } else {
        XLSX.writeFile(wb, `atlas-financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`, { bookType: 'csv' });
      }
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Excel export error:", error);
      setErrorMsg("Erro ao exportar arquivo.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 relative z-20">
        <div 
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-xl"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F59E0B]/10 rounded-lg">
              <Filter className="h-5 w-5 text-[#F59E0B]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Filtros de Relatório</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {showFilters ? 'Ocultar filtros' : 'Clique para filtrar por período ou veículo'}
              </p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {showFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {showFilters && (
          <CardContent className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Filtro</label>
                <CustomSelect 
                  value={filterType} 
                  onChange={(val) => setFilterType(val as any)}
                  options={[
                    { value: 'month', label: 'Por Mês' },
                    { value: 'year', label: 'Por Ano' },
                    { value: 'custom', label: 'Período Personalizado' }
                  ]}
                />
              </div>

              {filterType === 'month' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ano</label>
                    <CustomSelect 
                      value={selectedMonth.split('-')[0]} 
                      onChange={(val) => setSelectedMonth(`${val}-${selectedMonth.split('-')[1]}`)}
                      options={Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => ({
                        value: year.toString(),
                        label: year.toString()
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês</label>
                    <CustomSelect 
                      value={selectedMonth.split('-')[1]} 
                      onChange={(val) => setSelectedMonth(`${selectedMonth.split('-')[0]}-${val}`)}
                      options={Array.from({ length: 12 }, (_, i) => {
                        const monthNum = (i + 1).toString().padStart(2, '0');
                        const monthName = format(new Date(2000, i, 1), 'MMMM', { locale: ptBR });
                        return {
                          value: monthNum,
                          label: monthName.charAt(0).toUpperCase() + monthName.slice(1)
                        };
                      })}
                    />
                  </div>
                </div>
              ) : filterType === 'year' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ano</label>
                  <CustomSelect 
                    value={selectedYear} 
                    onChange={setSelectedYear}
                    options={Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => ({
                      value: year.toString(),
                      label: year.toString()
                    }))}
                  />
                  {!isPremium(user) && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Visão anual disponível apenas no Premium
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Inicial</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Final</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  {!isPremium(user) && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Período personalizado disponível apenas no Premium
                    </p>
                  )}
                </>
              )}

              {filterType === 'month' && !isPremium(user) && (
                (() => {
                  const [year, month] = selectedMonth.split('-');
                  const filterDate = new Date(Number(year), Number(month) - 1);
                  const now = new Date();
                  const isCurrentMonth = filterDate.getMonth() === now.getMonth() && filterDate.getFullYear() === now.getFullYear();
                  if (!isCurrentMonth) {
                    return (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg flex items-start gap-2">
                        <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          O histórico de meses anteriores está bloqueado no plano gratuito. 
                          <button onClick={() => { setPremiumFeatureName('Histórico Completo'); setIsPremiumModalOpen(true); }} className="ml-1 font-bold underline">Fazer Upgrade</button>
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Veículo</label>
                <CustomSelect 
                  value={selectedVehicleId} 
                  onChange={setSelectedVehicleId}
                  options={[
                    { value: 'all', label: 'Todos os Veículos' },
                    ...vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.plate})` }))
                  ]}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1 flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => {
                    if (!isPremium(user)) {
                      setPremiumFeatureName('Exportação de Relatórios');
                      setIsPremiumModalOpen(true);
                      return;
                    }
                    setIsExportModalOpen(true);
                  }}
                  className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center justify-center gap-2"
                >
                  {!isPremium(user) && <Lock className="h-4 w-4" />}
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
                {preferences.modulo_importacao && (
                  <Button 
                    onClick={() => {
                      if (!isPremium(user)) {
                        setPremiumFeatureName('Importação de Relatórios');
                        setIsPremiumModalOpen(true);
                        return;
                      }
                      setIsImportModalOpen(true);
                    }}
                    variant="outline"
                    className="w-full border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center justify-center gap-2"
                  >
                    {!isPremium(user) && <Lock className="h-4 w-4" />}
                    <Upload className="h-4 w-4" />
                    Importar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Modal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setErrorMsg('');
        }}
        title="Exportar Relatório"
      >
        <div className="space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm dark:bg-red-900/20 dark:text-red-400">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              Notas e Observações (opcional)
            </label>
            <textarea
              className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-[#F59E0B] transition-all outline-none"
              placeholder="Adicione observações que aparecerão no topo do relatório..."
              value={exportNotes}
              onChange={(e) => setExportNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={exportToPDF}
              disabled={exportLoading}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={() => exportToExcel('xlsx')}
              disabled={exportLoading}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel (XLSX)
            </Button>
            <Button
              onClick={() => exportToExcel('csv')}
              disabled={exportLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <FileJson className="h-4 w-4" />
              CSV
            </Button>
          </div>

          {exportLoading && (
            <p className="text-center text-xs text-gray-500 animate-pulse">
              Gerando arquivo, por favor aguarde...
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setErrorMsg('');
        }}
        title="Importar Relatório"
      >
        <div className="space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm dark:bg-red-900/20 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errorMsg}
            </div>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Instruções de Importação</h4>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc pl-4">
              <li>O arquivo deve ser Excel (.xlsx) ou CSV.</li>
              <li>Colunas necessárias: <strong>Data, Valor, Tipo</strong> (Receita ou Despesa).</li>
              <li>Colunas opcionais: <strong>Descrição, Categoria, Veículo, Placa</strong>.</li>
              <li>A data deve estar no formato DD/MM/AAAA ou ser um campo de data do Excel.</li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative group">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImport}
              disabled={importLoading}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                <Upload className="h-8 w-8 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {importLoading ? 'Processando...' : 'Clique ou arraste seu arquivo'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Suporta .xlsx, .xls e .csv
                </p>
              </div>
            </div>
          </div>

          {importLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 animate-pulse">
              <div className="h-4 w-4 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
              Importando dados, por favor aguarde...
            </div>
          )}
        </div>
      </Modal>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 sm:gap-4">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-2 sm:py-0">
          <CardHeader className="pb-1 sm:pb-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 space-y-0">
            <div className="p-1.5 sm:p-2 bg-green-50 dark:bg-[#059568]/20 rounded-full">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#059568] dark:text-[#10B981]" />
            </div>
            <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total Receitas</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div className="text-sm sm:text-2xl font-bold text-[#059568] dark:text-[#10B981] break-words">
              {formatCurrency(stats.receitas)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-2 sm:py-0">
          <CardHeader className="pb-1 sm:pb-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 space-y-0">
            <div className="p-1.5 sm:p-2 bg-red-50 dark:bg-[#EF4444]/20 rounded-full">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#EF4444] dark:text-[#F87171]" />
            </div>
            <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total Despesas</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div className="text-sm sm:text-2xl font-bold text-[#EF4444] dark:text-[#F87171] break-words">
              {formatCurrency(stats.despesas)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center py-2 sm:py-0">
          <CardHeader className="pb-1 sm:pb-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 space-y-0">
            <div className={`p-1.5 sm:p-2 rounded-full ${stats.lucroLiquido >= 0 ? 'bg-green-50 dark:bg-[#059568]/20' : 'bg-red-50 dark:bg-[#EF4444]/20'}`}>
              <DollarSign className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`} />
            </div>
            <CardTitle className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400">Saldo</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div
              className={`text-sm sm:text-2xl font-bold break-words ${
                stats.lucroLiquido >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'
              }`}
            >
              {formatCurrency(stats.lucroLiquido)}
            </div>
          </CardContent>
        </Card>
        {preferences.modulo_turnos && (
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center">
            <CardHeader className="pb-2 flex flex-row items-center justify-center gap-2 space-y-0">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Tempo Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {Math.floor(shiftStats.totalHours)}h {Math.round((shiftStats.totalHours % 1) * 60)}m
              </div>
            </CardContent>
          </Card>
        )}
        {preferences.modulo_turnos && (
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center">
            <CardHeader className="pb-2 flex flex-row items-center justify-center gap-2 space-y-0">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full">
                <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Média/Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(shiftStats.ganhoPorHora)}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 text-center">
          <CardHeader className="pb-2 flex flex-row items-center justify-center gap-2 space-y-0">
            <div className={`p-2 rounded-full ${stats.saldoAcumulado >= 0 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-red-50 dark:bg-[#EF4444]/20'}`}>
              <Wallet className={`h-4 w-4 ${stats.saldoAcumulado >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-[#EF4444] dark:text-[#F87171]'}`} />
            </div>
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Saldo Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.saldoAcumulado >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-[#EF4444] dark:text-[#F87171]'
              }`}
            >
              {formatCurrency(stats.saldoAcumulado)}
            </div>
          </CardContent>
        </Card>
      </div>

      {preferences.modulo_turnos && isPremium(user) && (
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <CardHeader 
            className="border-b border-gray-50 dark:border-gray-800 pb-4 bg-indigo-50/50 dark:bg-indigo-900/10 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
            onClick={() => setIsShiftsStatsOpen(!isShiftsStatsOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <CardTitle className="text-lg text-indigo-900 dark:text-indigo-100">Desempenho de Turnos (Raio-X)</CardTitle>
              </div>
              {isShiftsStatsOpen ? <ChevronUp className="h-5 w-5 text-indigo-400" /> : <ChevronDown className="h-5 w-5 text-indigo-400" />}
            </div>
          </CardHeader>
          {isShiftsStatsOpen && (
            <CardContent className="pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Horas Trabalhadas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {Math.floor(shiftStats.totalHours)}h {Math.round((shiftStats.totalHours % 1) * 60)}m
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Distância Percorrida</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {shiftStats.totalOdometer.toFixed(2)} km
                  </p>
                </div>
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-center">
                  <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mb-1">Ganho por Hora</p>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(shiftStats.ganhoPorHora)}/h
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-center">
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mb-1">Lucro por Hora</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(shiftStats.lucroPorHora)}/h
                  </p>
                </div>
              </div>

              {shiftStats.totalGoal > 0 && (
                <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Progresso das Metas do Período</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(shiftStats.receitasTurno)} / {formatCurrency(shiftStats.totalGoal)}
                    </p>
                  </div>
                  <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2.5">
                    <div 
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (shiftStats.receitasTurno / shiftStats.totalGoal) * 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-2 italic">
                    {shiftStats.receitasTurno >= shiftStats.totalGoal 
                      ? 'Parabéns! Você atingiu 100% das suas metas neste período.' 
                      : `Você atingiu ${((shiftStats.receitasTurno / shiftStats.totalGoal) * 100).toFixed(2)}% das metas acumuladas.`}
                  </p>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-semibold mb-1">Estimativa de Custo de Combustível: {formatCurrency(shiftStats.estimatedFuelCost)}</p>
                  <p className="opacity-80">Baseado na distância percorrida nos turnos ({shiftStats.totalOdometer.toFixed(2)} km) e na média de preço dos seus abastecimentos.</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
        <CardHeader 
          className="border-b border-gray-50 dark:border-gray-800 pb-4 bg-orange-50/50 dark:bg-orange-900/10"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 cursor-pointer min-w-[200px]" onClick={() => setIsHeatmapOpen(!isHeatmapOpen)}>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-orange-900 dark:text-orange-100">Mapa de Calor: Lucro Diário</CardTitle>
                <p className="text-xs text-orange-700/70 dark:text-orange-400/70">Visão mensal de rentabilidade</p>
              </div>
              {isHeatmapOpen ? <ChevronUp className="h-5 w-5 text-orange-400 ml-2" /> : <ChevronDown className="h-5 w-5 text-orange-400 ml-2" />}
            </div>

            <div className="flex-1 flex justify-center">
              <div className="flex items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1.5 border border-orange-100 dark:border-orange-900/30 shadow-sm min-w-[240px] justify-between">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600"
                  onClick={prevHeatmapMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 capitalize">
                  {heatmapData.monthLabel}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600"
                  onClick={nextHeatmapMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-[200px] justify-end">
              <div className="relative w-full sm:w-48">
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                <Select
                  value={heatmapVehicleId}
                  onChange={(e) => setHeatmapVehicleId(e.target.value)}
                  className="pl-9 h-9 border-orange-100 dark:border-orange-900/30 bg-white dark:bg-gray-800 text-xs rounded-full focus:ring-orange-500/20"
                >
                  <option value="all">Todos os Veículos</option>
                  <optgroup label="Ativos">
                    {vehicles.filter(v => v.status === 'active').map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Inativos">
                    {vehicles.filter(v => v.status !== 'active').map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
                    ))}
                  </optgroup>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        {isHeatmapOpen && (
          <CardContent className="pt-6 overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-2 mb-4">
                <div className="text-[10px] font-bold text-gray-400 flex items-center justify-center">SEMANA</div>
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>
              
              {heatmapData.weeks.map((week, wIndex) => (
                <div key={wIndex} className="grid grid-cols-[80px_repeat(7,1fr)] gap-2 mb-2">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center pr-3 justify-end bg-gray-50 dark:bg-gray-800/50 rounded-l-lg">
                    {week.name}
                  </div>
                  {week.days.map((day, dIndex) => {
                    const value = day.profit;
                    const isCurrentMonth = day.isCurrentMonth;
                    
                    // Color scale based on Daily Profit
                    let bgColor = 'bg-gray-100 dark:bg-gray-800/40';
                    if (!isCurrentMonth) {
                      bgColor = 'bg-transparent opacity-20';
                    } else if (value > 0 && value < 100) {
                      bgColor = 'bg-emerald-100 dark:bg-emerald-900/20';
                    } else if (value >= 100 && value < 250) {
                      bgColor = 'bg-emerald-300 dark:bg-emerald-700/40';
                    } else if (value >= 250 && value < 500) {
                      bgColor = 'bg-emerald-500 dark:bg-emerald-500/60';
                    } else if (value >= 500) {
                      bgColor = 'bg-emerald-700 dark:bg-emerald-400/80';
                    } else if (value < 0) {
                      bgColor = 'bg-red-100 dark:bg-red-900/20';
                    }

                    return (
                      <div 
                        key={dIndex}
                        className={`h-12 rounded-lg transition-all hover:scale-105 hover:shadow-md hover:z-10 cursor-help flex flex-col items-center justify-center relative ${bgColor} border border-transparent ${isCurrentMonth ? 'hover:border-emerald-400/50' : ''}`}
                        title={`${format(day.date, 'dd/MM/yyyy')}: ${formatCurrency(value)}`}
                      >
                        <span className={`text-[9px] absolute top-1 right-1 font-medium ${isCurrentMonth ? 'text-gray-400' : 'text-gray-300'}`}>
                          {format(day.date, 'dd')}
                        </span>
                        {isCurrentMonth && value !== 0 && (
                          <span className="text-sm font-black text-white [text-shadow:_1px_1px_0_#000,_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000]">
                            {value > 0 ? '+' : ''}{Math.round(value)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-red-100 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800/30"></div>
                  <span className="text-[11px] font-medium text-gray-500">Prejuízo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-gray-100 dark:bg-gray-800/40 rounded-md"></div>
                  <span className="text-[11px] font-medium text-gray-500">R$ 0</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-md"></div>
                  <span className="text-[11px] font-medium text-gray-500">&lt; R$ 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-emerald-300 dark:bg-emerald-700/40 rounded-md"></div>
                  <span className="text-[11px] font-medium text-gray-500">R$ 100-250</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-emerald-500 dark:bg-emerald-500/60 rounded-md"></div>
                  <span className="text-[11px] font-medium text-gray-500">R$ 250-500</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-emerald-700 dark:bg-emerald-400/80 rounded-md"></div>
                  <span className="text-[11px] font-medium text-gray-500">&gt; R$ 500</span>
                </div>
              </div>

              {/* Personal Use Summary Section */}
              {preferences.modulo_pessoal && (heatmapPersonalSummary.totalKm > 0 || heatmapPersonalSummary.totalCost > 0) && (
                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/30 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-400">
                    <Car className="h-4 w-4" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Resumo de Uso Pessoal</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Distância Percorrida</p>
                      <p className="text-xl font-black text-blue-900 dark:text-blue-100 tabular-nums">{heatmapPersonalSummary.totalKm} <span className="text-xs font-bold opacity-50">km</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Custo Total Estimado</p>
                      <p className="text-xl font-black text-blue-900 dark:text-blue-100 tabular-nums">{formatCurrency(heatmapPersonalSummary.totalCost)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {stats.porCategoria.filter((c) => c.tipo === 'despesa').length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma despesa no período.</p>
              ) : (
                stats.porCategoria
                  .filter((c) => c.tipo === 'despesa')
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                      <span className="text-sm font-bold text-[#EF4444] dark:text-[#F87171]">
                        {formatCurrency(cat.valor)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Receitas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {stats.porCategoria.filter((c) => c.tipo === 'receita').length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma receita no período.</p>
              ) : (
                stats.porCategoria
                  .filter((c) => c.tipo === 'receita')
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                      <span className="text-sm font-bold text-[#059568] dark:text-[#10B981]">
                        {formatCurrency(cat.valor)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {preferences.modulo_abastecimento_detalhado && isPremium(user) && stats.porCombustivel.length > 0 && (
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <CardHeader 
            className="border-b border-gray-50 dark:border-gray-800 pb-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => setIsFuelSummaryOpen(!isFuelSummaryOpen)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Resumo por Combustível</CardTitle>
              {isFuelSummaryOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </div>
          </CardHeader>
          {isFuelSummaryOpen && (
            <CardContent className="pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.porCombustivel.map((comb, index) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{comb.tipo}</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(comb.valor)}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{comb.litros.toFixed(2)} Litros</div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {stats.porVeiculo.length > 0 && (
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
          <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Resumo por Veículo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4 text-right">Receitas</th>
                    <th className="px-6 py-4 text-right">Despesas</th>
                    <th className="px-6 py-4 text-right">Saldo</th>
                    <th className="px-6 py-4 text-right">Tempo</th>
                    <th className="px-6 py-4 text-right">Ganho/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {stats.porVeiculo.map((v, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{v.nome}</div>
                        <div className="text-[10px] text-gray-500">{v.placa}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-[#059568] dark:text-[#10B981] font-medium">
                        {formatCurrency(v.receitas)}
                      </td>
                      <td className="px-6 py-4 text-right text-[#EF4444] dark:text-[#F87171] font-medium">
                        {formatCurrency(v.despesas)}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${v.saldo >= 0 ? 'text-[#059568] dark:text-[#10B981]' : 'text-[#EF4444] dark:text-[#F87171]'}`}>
                        {formatCurrency(v.saldo)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                        {Math.floor(v.totalMinutes / 60)}h {Math.round(v.totalMinutes % 60)}m
                      </td>
                      <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 font-bold">
                        {formatCurrency(v.ganhoPorHora)}/h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Comparativo Mensal</CardTitle>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowChartFilter(!showChartFilter)} 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Filter className="h-4 w-4" />
            </Button>
            {showChartFilter && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="py-1">
                  {[1, 3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => {
                        setChartMonthsFilter(months);
                        setShowChartFilter(false);
                      }}
                      className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        chartMonthsFilter === months 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      Últimos {months} {months === 1 ? 'mês' : 'meses'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full bg-white dark:bg-gray-900 rounded-lg p-2" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff' }}
                  itemStyle={{ color: '#111827' }}
                  labelStyle={{ color: '#6b7280', marginBottom: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Receitas" fill="#059568" radius={[6, 6, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Produtividade (Horas Trabalhadas)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full bg-white dark:bg-gray-900 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}h`}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} horas`, 'Tempo']}
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff' }}
                  itemStyle={{ color: '#111827' }}
                  labelStyle={{ color: '#6b7280', marginBottom: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Horas" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Chart for PDF Export */}
      <div 
        id="report-chart-container"
        style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', height: '400px' }}
        ref={reportChartRef}
      >
        <div className="bg-white p-8 w-full h-full">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Comparativo do Período</h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={reportChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                dx={-10}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="Receitas" fill="#059568" radius={[6, 6, 0, 0]} maxBarSize={50} />
              <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        featureName={premiumFeatureName}
        user={user}
      />
    </div>
  );
}
