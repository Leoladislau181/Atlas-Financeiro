import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPreferences } from '@/types';
import { supabase } from '@/lib/supabase';

interface FeatureContextType {
  preferences: UserPreferences;
  toggleFeature: (feature: keyof UserPreferences) => Promise<void>;
  loading: boolean;
}

const defaultPreferences: UserPreferences = {
  modulo_pessoal: true,
  modulo_turnos: false,
  modulo_abastecimento_detalhado: false,
  modulo_multiplas_categorias: true,
  alerta_manutencao: false,
  modulo_importacao: false,
  tema_escuro: false,
};

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export function FeatureProvider({ children, user }: { children: React.ReactNode, user: any }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      setPreferences(defaultPreferences);
      setLoading(false);
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (data?.preferences) {
        setPreferences({ ...defaultPreferences, ...data.preferences });
      }
    } catch (err) {
      console.error('Erro ao carregar preferências:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (feature: keyof UserPreferences) => {
    if (!user) return;

    const newPreferences = {
      ...preferences,
      [feature]: !preferences[feature],
    };

    setPreferences(newPreferences);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: newPreferences })
        .eq('id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao salvar preferência:', err);
      // Revert in case of error
      setPreferences(preferences);
    }
  };

  return (
    <FeatureContext.Provider value={{ preferences, toggleFeature, loading }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures deve ser usado dentro de um FeatureProvider');
  }
  return context;
}
