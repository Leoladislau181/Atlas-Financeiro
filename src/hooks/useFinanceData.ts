import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Categoria, Lancamento } from '@/types';

export function useFinanceData() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
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

      const { data: lanData, error: lanError } = await supabase
        .from('lancamentos')
        .select('*, categorias(*)')
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

  return { categorias, lancamentos, loading, refetch: fetchData };
}
