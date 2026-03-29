import { useState, useEffect } from 'react';
import { Lancamento, Vehicle, FuelType } from '@/types';
import { formatCurrency, parseCurrency, parseLocalDate } from '@/lib/utils';

interface UseFuelAutoFillProps {
  vehicleId: string;
  fuelType: FuelType | null;
  lancamentos: Lancamento[];
  vehicles: Vehicle[];
  isActive: boolean; // e.g., is expense and is fuel category and not editing
  valorStr: string;
  pricePerLiterStr: string;
  isOdometerManuallyEdited: boolean;
  triggerDependency?: string;
}

export function useFuelAutoFill({
  vehicleId,
  fuelType,
  lancamentos,
  vehicles,
  isActive,
  valorStr,
  pricePerLiterStr,
  isOdometerManuallyEdited,
  triggerDependency = ''
}: UseFuelAutoFillProps) {
  const [lastAutoFillTrigger, setLastAutoFillTrigger] = useState('');
  const [lastFuelData, setLastFuelData] = useState<{
    pricePerLiter: number | null;
    lastOdometer: number | null;
    avgConsumption: number | null;
  } | null>(null);

  const [suggestedPricePerLiter, setSuggestedPricePerLiter] = useState<string | null>(null);
  const [suggestedOdometer, setSuggestedOdometer] = useState<string | null>(null);

  useEffect(() => {
    const triggerKey = `${vehicleId}-${fuelType}-${triggerDependency}`;

    if (isActive && vehicleId) {
      const vLancamentos = lancamentos.filter(l => l.vehicle_id === vehicleId);
      
      const fuelEntries = vLancamentos
        .filter(l => l.fuel_price_per_liter && l.fuel_liters && l.odometer && (!fuelType || l.fuel_type === fuelType))
        .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime());

      const lastFuelEntry = fuelEntries.length > 0 ? fuelEntries[0] : null;
      const lastPrice = lastFuelEntry?.fuel_price_per_liter || null;
      
      const odoEntries = vLancamentos
        .filter(l => l.odometer)
        .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime());
      
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const lastOdo = odoEntries.length > 0 ? odoEntries[0].odometer! : (vehicle?.initial_odometer || null);

      let totalLitros = 0;
      let kmRodadoCombustivel = 0;

      // Sort all fuel entries by odometer
      const sortedFuelEntries = vLancamentos
        .filter(l => l.tipo === 'despesa' && l.fuel_liters && l.fuel_liters > 0 && l.odometer)
        .sort((a, b) => a.odometer! - b.odometer!);

      sortedFuelEntries.forEach((entry, index) => {
        const consumedFuelType = index > 0 ? (sortedFuelEntries[index - 1].fuel_type || 'unknown') : (entry.fuel_type || 'unknown');
        
        if (!fuelType || consumedFuelType === fuelType) {
          totalLitros += Number(entry.fuel_liters);
          const prevOdometer = index > 0 ? sortedFuelEntries[index - 1].odometer! : (vehicle?.initial_odometer || 0);
          const distance = entry.odometer! - prevOdometer;
          if (distance > 0) {
            kmRodadoCombustivel += distance;
          }
        }
      });

      const avgConsumption = totalLitros > 0 ? (kmRodadoCombustivel / totalLitros) : null;

      setLastFuelData({
        pricePerLiter: lastPrice,
        lastOdometer: lastOdo,
        avgConsumption: avgConsumption
      });

      if (triggerKey !== lastAutoFillTrigger) {
        if (lastPrice) {
          setSuggestedPricePerLiter(formatCurrency(lastPrice));
        } else {
          setSuggestedPricePerLiter(null);
        }
        setLastAutoFillTrigger(triggerKey);
      }
    } else if (!isActive || !vehicleId) {
      setLastFuelData(null);
      setLastAutoFillTrigger(triggerKey);
      setSuggestedPricePerLiter(null);
    }
  }, [vehicleId, fuelType, lancamentos, vehicles, isActive, lastAutoFillTrigger]);

  useEffect(() => {
    if (isActive && vehicleId && !isOdometerManuallyEdited && lastFuelData) {
      const valorNum = parseCurrency(valorStr);
      const pricePerLiter = parseCurrency(pricePerLiterStr);
      
      if (valorNum > 0 && pricePerLiter > 0 && lastFuelData.lastOdometer !== null && lastFuelData.avgConsumption !== null && lastFuelData.avgConsumption > 0) {
        const liters = valorNum / pricePerLiter;
        const expectedKm = liters * lastFuelData.avgConsumption;
        const expectedOdometer = Math.round(lastFuelData.lastOdometer + expectedKm);
        
        setSuggestedOdometer(expectedOdometer.toString());
      } else if (valorNum === 0 || pricePerLiter === 0) {
        setSuggestedOdometer('');
      }
    } else if (!isActive || !vehicleId) {
      setSuggestedOdometer(null);
    }
  }, [valorStr, pricePerLiterStr, lastFuelData, isOdometerManuallyEdited, isActive, vehicleId]);

  return {
    lastFuelData,
    suggestedPricePerLiter,
    suggestedOdometer,
    setLastAutoFillTrigger // Expose this if we need to reset it manually (e.g., after reading receipt)
  };
}
