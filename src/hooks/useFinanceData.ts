import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Categoria, Lancamento, Vehicle } from '@/types';

export function useFinanceData() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: catData, error: catError } = await supabase
        .from('categorias')
        .select('*')
        .order('nome');
      
      if (catError) throw catError;
      setCategorias(catData || []);

      const { data: vehData, error: vehError } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');
      
      if (vehError && vehError.code !== '42P01') throw vehError; // Ignore if table doesn't exist yet
      setVehicles(vehData || []);

      const { data: lanData, error: lanError } = await supabase
        .from('lancamentos')
        .select('*, categorias(*), vehicles(*)')
        .order('data', { ascending: false });

      if (lanError) throw lanError;
      setLancamentos(lanData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { categorias, lancamentos, vehicles, loading, refetch: fetchData };
}
