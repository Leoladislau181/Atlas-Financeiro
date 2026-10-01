import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { User } from '@/types';
import { isPremium, cn } from '@/lib/utils';
import { 
  Tag, 
  Car, 
  Clock, 
  Settings, 
  BarChart2, 
  Star, 
  ArrowLeft, 
  X, 
  Fuel, 
  Layers, 
  Bell, 
  Upload,
  Shield,
  Briefcase
} from 'lucide-react';
import { useFeatures } from '@/contexts/FeatureContext';

interface FuncionalidadesProps {
  user: User;
  onBackToConfig: () => void;
  onBackToHome: () => void;
  onNavigateToPremium?: () => void;
}

export function Funcionalidades({ user, onBackToConfig, onBackToHome, onNavigateToPremium }: FuncionalidadesProps) {
  const { preferences, toggleFeature } = useFeatures();

  // Unified list of features
  const allFeatures = [
    {
      id: 'financeiro',
      title: 'Gestão Financeira',
      icon: <Tag className="h-5 w-5 text-emerald-500" />,
      description: 'Controle completo de receitas e despesas com categorias personalizadas e filtros por período. Visualize seu saldo líquido e acompanhe o fluxo de caixa em tempo real.',
      isFree: true
    },
    {
      id: 'veiculos',
      title: 'Controle de Veículos',
      icon: <Car className="h-5 w-5 text-blue-500" />,
      description: 'Gerencie sua frota, acompanhe o desempenho individual de cada veículo e defina metas de lucro. Tenha o controle total de gastos por carro ou moto.',
      isFree: true
    },
    {
      id: 'modulo_multiplas_categorias',
      title: 'Múltiplas Categorias',
      icon: <Layers className="h-5 w-5 text-purple-600" />,
      description: 'Permite criar e gerenciar categorias personalizadas para melhor organização dos seus lançamentos.',
      isFree: true,
      preferenceKey: 'modulo_multiplas_categorias'
    },
    {
      id: 'modulo_pessoal',
      title: 'Uso Pessoal',
      icon: <Car className="h-5 w-5 text-blue-600" />,
      description: 'Ativa campos de quilometragem específicos para uso pessoal, separando do uso profissional.',
      isFree: true,
      preferenceKey: 'modulo_pessoal'
    },
    {
      id: 'modulo_turnos',
      title: 'Controle de Turnos',
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      description: 'Ativa o gerenciamento de horas e ganhos por turno. Registre sua jornada de trabalho e saiba exatamente quanto ganha por hora.',
      isFree: false,
      preferenceKey: 'modulo_turnos',
      premiumName: 'Gestão de Turnos'
    },
    {
      id: 'modulo_abastecimento_detalhado',
      title: 'Abastecimento Detalhado',
      icon: <Fuel className="h-5 w-5 text-emerald-600" />,
      description: 'Campos extras como tipo de combustível e preço por litro para um controle de consumo mais preciso.',
      isFree: false,
      preferenceKey: 'modulo_abastecimento_detalhado',
      premiumName: 'Abastecimento Detalhado'
    },
    {
      id: 'alerta_manutencao',
      title: 'Alertas de Manutenção',
      icon: <Bell className="h-5 w-5 text-rose-600" />,
      description: 'Receba avisos automáticos para troca de óleo e revisões baseados na quilometragem rodada.',
      isFree: false,
      preferenceKey: 'alerta_manutencao',
      premiumName: 'Alertas de Manutenção'
    },
    {
      id: 'modulo_importacao',
      title: 'Módulo de Importação',
      icon: <Upload className="h-5 w-5 text-indigo-600" />,
      description: 'Ativa a funcionalidade de importar dados de arquivos externos (CSV/Excel) para o sistema.',
      isFree: false,
      preferenceKey: 'modulo_importacao',
      premiumName: 'Módulo de Importação'
    },
    {
      id: 'relatorios',
      title: 'Dashboards e Relatórios',
      icon: <BarChart2 className="h-5 w-5 text-purple-500" />,
      description: 'Visualize sua evolução em gráficos interativos e exporte relatórios profissionais em PDF ou Excel.',
      isFree: true
    }
  ];

  const handleToggle = (feature: any) => {
    if (!feature.preferenceKey) return;
    
    if (!feature.isFree && !isPremium(user)) {
      if (onNavigateToPremium) {
        onNavigateToPremium();
      }
      return;
    }
    
    toggleFeature(feature.preferenceKey);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between -mb-2 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm sm:shadow-none sm:bg-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBackToConfig}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recursos e Funcionalidades</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBackToHome}
          className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {allFeatures.map((feature) => (
          <Card key={feature.id} className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden group">
            <CardContent className="p-0">
              <div className="p-5 flex items-start gap-4">
                <div className={cn(
                  "p-3 rounded-xl shrink-0 transition-colors",
                  feature.isFree ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-amber-50 dark:bg-amber-900/20"
                )}>
                  {feature.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{feature.title}</h4>
                      {feature.isFree ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 uppercase tracking-wider">Livre</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wider">Premium</span>
                      )}
                    </div>
                    
                    {!feature.isFree && feature.preferenceKey && (
                      <Switch 
                        checked={!!(preferences as any)[feature.preferenceKey]}
                        onCheckedChange={() => handleToggle(feature)}
                      />
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-none text-white overflow-hidden relative">
        <div className="absolute top-[-20px] right-[-20px] opacity-10">
          <Star className="h-32 w-32 rotate-12" />
        </div>
        <CardContent className="p-8 relative z-10">
          <h3 className="text-2xl font-black mb-2">Acesso Total com Premium</h3>
          <p className="text-white/90 mb-6 max-w-lg">
            Ative todos os módulos avançados, exporte relatórios ilimitados e tenha suporte prioritário no WhatsApp.
          </p>
          {!isPremium(user) ? (
            <Button 
              onClick={onNavigateToPremium}
              className="bg-white text-orange-600 hover:bg-white/90 font-bold px-8"
            >
              Conhecer Planos
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-white font-bold bg-white/20 w-fit px-4 py-2 rounded-full">
              <Shield className="h-5 w-5" />
              Assinatura Ativa
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
