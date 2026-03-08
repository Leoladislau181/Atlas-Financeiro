import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, parseLocalDate } from '@/lib/utils';
import { Lancamento } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { ArrowUpCircle, ArrowDownCircle, DollarSign, Wallet } from 'lucide-react';

interface DashboardProps {
  lancamentos: Lancamento[];
}

export function Dashboard({ lancamentos }: DashboardProps) {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const stats = useMemo(() => {
    let receitasMes = 0;
    let despesasMes = 0;
    let saldoGeral = 0;

    lancamentos.forEach((l) => {
      const valor = Number(l.valor);
      const data = parseLocalDate(l.data);
      const isCurrentMonth = isWithinInterval(data, { start, end });

      if (l.tipo === 'receita') {
        saldoGeral += valor;
        if (isCurrentMonth) receitasMes += valor;
      } else {
        saldoGeral -= valor;
        if (isCurrentMonth) despesasMes += valor;
      }
    });

    return {
      receitasMes,
      despesasMes,
      lucroLiquido: receitasMes - despesasMes,
      saldoGeral,
    };
  }, [lancamentos, start, end]);

  const chartData = useMemo(() => {
    return [
      {
        name: format(now, 'MMMM yyyy', { locale: ptBR }).toUpperCase(),
        Receitas: stats.receitasMes,
        Despesas: stats.despesasMes,
      },
    ];
  }, [stats, now]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Receitas do Mês</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-[#059568]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#059568]">
              {formatCurrency(stats.receitasMes)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Despesas do Mês</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-[#EF4444]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#EF4444]">
              {formatCurrency(stats.despesasMes)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Lucro Líquido</CardTitle>
            <DollarSign className={`h-4 w-4 ${stats.lucroLiquido >= 0 ? 'text-[#059568]' : 'text-[#EF4444]'}`} />
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

      <Card className="col-span-3 border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Visão Mensal</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: '#F3F4F6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Receitas" fill="#059568" radius={[6, 6, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
