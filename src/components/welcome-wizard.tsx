import React, { useState, useEffect } from 'react';
import { User, Vehicle, Categoria } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Tag, User as UserIcon, ChevronRight, Plus, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeWizardProps {
  user: User;
  vehicles: Vehicle[];
  categorias: Categoria[];
  refetch: () => void;
  onUserUpdate?: (user: Partial<User>) => void;
  isOpen: boolean;
  onComplete: () => void;
}

export function WelcomeWizard({ user, vehicles, categorias, refetch, onUserUpdate, isOpen, onComplete }: WelcomeWizardProps) {
  const [step, setStep] = useState(() => {
    if (!user.nome || user.nome === '') return 1;
    if (vehicles.length === 0) return 2;
    return 3;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Step 1: Name
  const [nome, setNome] = useState(user.nome || '');
  
  // Step 2: Vehicle
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [initialOdometer, setInitialOdometer] = useState('');

  // Sync step if user data changes externally (e.g. from refetch)
  // but only if we are moving forward to avoid "jumping back"
  useEffect(() => {
    if (step === 1 && user.nome && user.nome !== '') {
      setStep(2);
    }
  }, [user.nome, step]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      // 1. Atualizar/Criar Profile (Usar upsert para garantir que exista)
      const { error: profileError } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        nome: nome.trim() 
      });
      if (profileError) throw profileError;

      // 2. Atualizar Auth Metadata
      await supabase.auth.updateUser({ data: { nome: nome.trim() } });
      
      // 3. Atualizar estado local do pai
      if (onUserUpdate) {
        onUserUpdate({ nome: nome.trim() });
      }

      await refetch();
      setStep(2);
    } catch (err: any) {
      console.error('Error saving name:', err);
      setError(err.message || 'Erro ao salvar nome. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { error: vehError } = await supabase.from('vehicles').insert([{
        user_id: user.id,
        name: vehicleName,
        plate: vehiclePlate || 'NÃO INF.',
        initial_odometer: Number(initialOdometer) || 0,
        status: 'active',
        type: 'own'
      }]);
      
      if (vehError) throw vehError;

      await refetch();
      setStep(3);
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setError(err.message || 'Erro ao cadastrar veículo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const skipVehicle = () => {
    setStep(3);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Progress Header */}
        <div className="p-8 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-8">
            <img src="/logo.svg" alt="Logo" className="h-10 w-10" />
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={cn(
                    "h-1.5 w-12 rounded-full transition-all duration-500",
                    s <= step ? "bg-indigo-600 shadow-sm shadow-indigo-500/50" : "bg-gray-100 dark:bg-gray-800"
                  )} 
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 pt-2 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                  Seja muito bem-vindo, parceiro! 👋
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Primeiro, como devemos chamar você no aplicativo?
                </p>
              </div>

              <form onSubmit={handleSaveName} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-1">Seu Nome Completo</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <Input 
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: João Silva"
                      className={cn(
                        "h-14 pl-12 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-lg font-bold",
                        error && "border-red-500 ring-4 ring-red-500/10"
                      )}
                      required
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="text-sm font-bold text-red-500 ml-1 animate-in shake duration-300">
                      ⚠️ {error}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || !nome.trim()} 
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-500/20 font-black text-lg transition-all active:scale-[0.98]"
                >
                  {loading ? 'SALVANDO...' : 'PRÓXIMO PASSO'}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 text-left">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                  Seu Veículo 🚗
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Para calcularmos seu lucro real, precisamos saber qual veículo você utiliza.
                </p>
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-1">Modelo do Veículo</label>
                    <Input 
                      value={vehicleName}
                      onChange={(e) => setVehicleName(e.target.value)}
                      placeholder="Ex: Fiat Cronos 1.3"
                      className={cn(
                        "h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800",
                        error && "border-red-500 ring-2 ring-red-500/10"
                      )}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-1">Placa (Opcional)</label>
                      <Input 
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                        placeholder="ABC-1234"
                        className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-1">KM Atual</label>
                      <Input 
                        type="number"
                        value={initialOdometer}
                        onChange={(e) => setInitialOdometer(e.target.value)}
                        placeholder="0"
                        className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 ml-1 animate-in shake duration-300">
                    ⚠️ {error}
                  </p>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <Button 
                    type="submit" 
                    disabled={loading || !vehicleName.trim()} 
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-500/20 font-black text-lg transition-all active:scale-[0.98]"
                  >
                    {loading ? 'CADASTRANDO...' : 'CADASTRAR VEÍCULO'}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={skipVehicle}
                    className="w-full h-12 text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest text-[10px]"
                  >
                    Não tenho esses dados agora, pular passo
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                  Tudo pronto por aqui! 🚀
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Já criamos as categorias básicas para você começar (Uber, 99, Combustível, etc).
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50 flex gap-4">
                  <div className="shrink-0 h-12 w-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                    <Tag className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">Categorias de Lançamento</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                      Elas servem para organizar de onde vem seu dinheiro e para onde ele vai. Você pode criar novas categorias a qualquer momento nas configurações.
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50 flex gap-4">
                  <div className="shrink-0 h-12 w-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">Configuração Concluída</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                      Agora você já pode registrar seus ganhos, combustível e despesas para ter o controle total da sua frota.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={onComplete}
                className="w-full h-14 bg-gray-900 dark:bg-white dark:text-gray-900 rounded-2xl shadow-xl font-black text-lg transition-all active:scale-[0.98] group"
              >
                ACESSAR MEU DASHBOARD
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>

        {/* Footer info icon for all steps */}
        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 flex justify-center border-t border-gray-100 dark:border-gray-800 shrink-0">
          <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5 uppercase tracking-widest">
            <Info className="h-3 w-3" />
            Configuração rápida inicial Atlas
          </p>
        </div>
      </div>
    </div>
  );
}
