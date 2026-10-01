import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useOnboarding(user: User | null) {
  const [hasVehicles, setHasVehicles] = useState<boolean>(true); // Default true to avoid flash
  const [hasCategories, setHasCategories] = useState<boolean>(true);
  const [hasTransactions, setHasTransactions] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      setIsLoading(true);
      try {
        const [vehiclesRes, categoriesRes, transactionsRes] = await Promise.all([
          supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('lancamentos').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);

        setHasVehicles((vehiclesRes.count || 0) > 0);
        setHasCategories((categoriesRes.count || 0) > 0);
        setHasTransactions((transactionsRes.count || 0) > 0);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { hasVehicles, hasCategories, hasTransactions, isLoading };
}
