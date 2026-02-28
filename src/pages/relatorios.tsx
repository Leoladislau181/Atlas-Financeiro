import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseLocalDate } from '@/lib/utils';
import { Lancamento, Vehicle } from '@/types';
import { format, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RelatoriosProps {
  lancamentos: Lancamento[];
  vehicles: Vehicle[];
}

export function Relatorios({ lancamentos, vehicles }: RelatoriosProps) {
  const [filterType, setFilterType] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');

  const filteredLancamentos = useMemo(() => {
    let start: Date;
    let end: Date;

    if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      start = startOfMonth(new Date(Number(year), Number(month) - 1));
      end = endOfMonth(new Date(Number(year), Number(month) - 1));
    } else {
      start = parseLocalDate(startDate);
      end = parseLocalDate(endDate);
    }

    return lancamentos.filter((l) => {
      const data = parseLocalDate(l.data);
      const matchesDate = isWithinInterval(data, { start, end });
      const matchesVehicle = selectedVehicleId === 'all' || l.vehicle_id === selectedVehicleId;
      return matchesDate && matchesVehicle;
    });
  }, [lancamentos, filterType, selectedMonth, startDate, endDate, selectedVehicleId]);

  const stats = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    const porCategoria: Record<string, { nome: string; valor: number; tipo: string }> = {};

    filteredLancamentos.forEach((l) => {
      const valor = Number(l.valor);
      if (l.tipo === 'receita') {
        receitas += valor;
      } else {
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
    });

    return {
      receitas,
      despesas,
      lucroLiquido: receitas - despesas,
      porCategoria: Object.values(porCategoria).sort((a, b) => b.valor - a.valor),
    };
  }, [filteredLancamentos]);

  const chartData = useMemo(() => {
    // Generate last 6 months data
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
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
        name: format(date, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        Receitas: receitas,
        Despesas: despesas,
      });
    }
    return data;
  }, [lancamentos]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tipo de Filtro</label>
              <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                <option value="month">Por Mês</option>
                <option value="custom">Período Personalizado</option>
              </Select>
            </div>

            {filterType === 'month' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Mês</label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Data Inicial</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Data Final</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Veículo</label>
              <Select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
                <option value="all">Todos os Veículos</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#059568]">
              {formatCurrency(stats.receitas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#EF4444]">
              {formatCurrency(stats.despesas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.lucroLiquido >= 0 ? 'text-[#059568]' : 'text-[#EF4444]'
              }`}
            >
              {formatCurrency(stats.lucroLiquido)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.porCategoria.filter((c) => c.tipo === 'despesa').length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma despesa no período.</p>
              ) : (
                stats.porCategoria
                  .filter((c) => c.tipo === 'despesa')
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{cat.nome}</span>
                      <span className="text-sm font-bold text-[#EF4444]">
                        {formatCurrency(cat.valor)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receitas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.porCategoria.filter((c) => c.tipo === 'receita').length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma receita no período.</p>
              ) : (
                stats.porCategoria
                  .filter((c) => c.tipo === 'receita')
                  .map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{cat.nome}</span>
                      <span className="text-sm font-bold text-[#059568]">
                        {formatCurrency(cat.valor)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo Mensal (Últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Legend />
                <Bar dataKey="Receitas" fill="#059568" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
