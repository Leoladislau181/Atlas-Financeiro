import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Categoria, Lancamento, Vehicle, Manutencao } from '@/types';

// Variáveis globais para evitar condições de corrida (race conditions) no React
let initPromise: Promise<Categoria[]> | null = null;
let initUserId: string | null = null;

export function useFinanceData() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const [catResult, vehResult, manResult, lanResult] = await Promise.all([
        supabase.from('categorias').select('*').eq('user_id', userId).order('nome'),
        supabase.from('vehicles').select('*').eq('user_id', userId).order('name'),
        supabase.from('manutencoes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('lancamentos').select('*, categorias(*), vehicles(*)').eq('user_id', userId).order('data', { ascending: false })
      ]);

      let catData = catResult.data || [];
      const catError = catResult.error;
      
      if (catError) throw catError;

      // Check and create default categories if they don't exist
      const defaultCategories = [
        { nome: 'Manutenção', tipo: 'despesa', is_system_default: true, is_deductible: true },
        { nome: 'Combustível', tipo: 'despesa', is_system_default: true, is_deductible: true },
        { nome: 'Particular', tipo: 'receita', is_system_default: true, is_deductible: false },
        { nome: 'Aluguel', tipo: 'despesa', is_system_default: true, is_deductible: true }
      ];

      const missingDefaults = defaultCategories.filter(
        def => !catData.some(c => c.nome.toLowerCase() === def.nome.toLowerCase() && c.tipo === def.tipo)
      );

      if (missingDefaults.length > 0) {
        // Se já existe uma promessa rodando para este usuário, aguardamos ela
        if (initUserId !== userId || !initPromise) {
          initUserId = userId;
          initPromise = (async () => {
            const { data: newCats, error: insertError } = await supabase
              .from('categorias')
              .insert(missingDefaults.map(def => ({ ...def, user_id: userId })))
              .select();
            
            if (insertError) {
              // Se falhar (ex: restrição de unicidade por concorrência de outra aba),
              // buscamos novamente as categorias para garantir que temos os dados mais recentes.
              const { data: fallbackData } = await supabase
                .from('categorias')
                .select('*')
                .eq('user_id', userId)
                .order('nome');
              return fallbackData || catData;
            }
            
            if (newCats) {
              return [...catData, ...newCats].sort((a, b) => a.nome.localeCompare(b.nome));
            }
            return catData;
          })();
        }
        catData = await initPromise;
      }

      setCategorias(catData);

      const vehError = vehResult.error;
      if (vehError && vehError.code !== '42P01') throw vehError; // Ignore if table doesn't exist yet
      setVehicles(vehResult.data || []);

      const manError = manResult.error;
      if (manError && manError.code !== '42P01') throw manError;
      setManutencoes(manResult.data || []);

      const lanError = lanResult.error;
      if (lanError) throw lanError;
      setLancamentos(lanResult.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Erro ao carregar dados do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { categorias, lancamentos, vehicles, manutencoes, loading, error, refetch: fetchData };
}
