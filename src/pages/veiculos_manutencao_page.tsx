import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Vehicle, Manutencao, Lancamento, WorkShift } from '@/types';
import { ChevronLeft } from 'lucide-react';
import { Veiculos } from './veiculos';
import { ManutencaoPage } from './manutencao';

interface VeiculosManutencaoPageProps {
  user: User;
  vehicles: Vehicle[];
  lancamentos: Lancamento[];
  manutencoes: Manutencao[];
  workShifts: WorkShift[];
  refetch: () => void;
  onBack: () => void;
  onBackToHome: () => void;
  forceOpenAdd?: boolean;
}

export function VeiculosManutencaoPage({ 
  user, 
  vehicles, 
  lancamentos, 
  manutencoes, 
  workShifts, 
  refetch, 
  onBack,
  onBackToHome,
  forceOpenAdd = false
}: VeiculosManutencaoPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'veiculos' | 'manutencao'>('veiculos');

  useEffect(() => {
    if (forceOpenAdd) {
      setActiveSubTab('veiculos');
    }
  }, [forceOpenAdd]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
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
            Veículos e Manutenção
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie sua frota e agendamentos</p>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden rounded-3xl">
        <CardContent className="p-4 sm:p-6">
          {/* Tabs Toggle */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8">
            <button
              onClick={() => setActiveSubTab('veiculos')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeSubTab === 'veiculos' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Meus Veículos
            </button>
            <button
              onClick={() => setActiveSubTab('manutencao')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                activeSubTab === 'manutencao' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Manutenções
            </button>
          </div>

          <div className="mt-4">
            {activeSubTab === 'veiculos' ? (
              <Veiculos 
                user={user}
                vehicles={vehicles}
                lancamentos={lancamentos}
                manutencoes={manutencoes}
                workShifts={workShifts}
                refetch={refetch}
                isEmbedded={true}
                forceOpenAdd={forceOpenAdd}
              />
            ) : (
              <ManutencaoPage 
                user={user}
                vehicles={vehicles}
                lancamentos={lancamentos}
                manutencoes={manutencoes}
                refetch={refetch}
                isEmbedded={true}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
