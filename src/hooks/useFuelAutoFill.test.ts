import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFuelAutoFill } from './useFuelAutoFill';
import { Lancamento, Vehicle } from '@/types';

describe('useFuelAutoFill', () => {
  const mockVehicles: Vehicle[] = [
    {
      id: 'v1',
      user_id: 'u1',
      name: 'Carro Teste',
      plate: 'ABC1234',
      initial_odometer: 10000,
      type: 'own',
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];

  const mockLancamentos: Lancamento[] = [
    {
      id: 'l1',
      user_id: 'u1',
      tipo: 'despesa',
      valor: 100,
      data: '2023-10-01',
      categoria_id: 'c1',
      vehicle_id: 'v1',
      fuel_type: 'gasolina',
      fuel_liters: 20,
      fuel_price_per_liter: 5,
      odometer: 10200, // 200km rodados com 20L = 10km/L
      observacao: '',
      created_at: new Date().toISOString()
    }
  ];

  it('should return nulls when inactive', () => {
    const { result } = renderHook(() => useFuelAutoFill({
      vehicleId: 'v1',
      fuelType: 'gasolina',
      lancamentos: mockLancamentos,
      vehicles: mockVehicles,
      isActive: false,
      valorStr: '',
      pricePerLiterStr: '',
      isOdometerManuallyEdited: false
    }));

    expect(result.current.lastFuelData).toBeNull();
    expect(result.current.suggestedPricePerLiter).toBeNull();
    expect(result.current.suggestedOdometer).toBeNull();
  });

  it('should calculate last fuel data and suggest price when active', () => {
    const { result } = renderHook(() => useFuelAutoFill({
      vehicleId: 'v1',
      fuelType: 'gasolina',
      lancamentos: mockLancamentos,
      vehicles: mockVehicles,
      isActive: true,
      valorStr: '',
      pricePerLiterStr: '',
      isOdometerManuallyEdited: false
    }));

    expect(result.current.lastFuelData).toEqual({
      pricePerLiter: 5,
      lastOdometer: 10200,
      avgConsumption: 10 // 200km / 20L
    });

    // Should format the price (R$ 5,00)
    expect(result.current.suggestedPricePerLiter).toContain('5,00');
  });

  it('should suggest odometer based on value and price per liter', () => {
    const { result } = renderHook(() => useFuelAutoFill({
      vehicleId: 'v1',
      fuelType: 'gasolina',
      lancamentos: mockLancamentos,
      vehicles: mockVehicles,
      isActive: true,
      valorStr: 'R$ 100,00', // 10000 cents
      pricePerLiterStr: 'R$ 5,00', // 500 cents
      isOdometerManuallyEdited: false
    }));

    // 100 reais / 5 reais/L = 20 Liters
    // 20 Liters * 10 km/L = 200 km
    // Last odometer = 10200
    // Expected = 10200 + 200 = 10400
    expect(result.current.suggestedOdometer).toBe('10400');
  });

  it('should not suggest odometer if manually edited', () => {
    const { result } = renderHook(() => useFuelAutoFill({
      vehicleId: 'v1',
      fuelType: 'gasolina',
      lancamentos: mockLancamentos,
      vehicles: mockVehicles,
      isActive: true,
      valorStr: 'R$ 100,00',
      pricePerLiterStr: 'R$ 5,00',
      isOdometerManuallyEdited: true
    }));

    // Hook logic: if manually edited, it doesn't calculate suggestions, but it might still hold previous state.
    // Actually, in the hook, if isOdometerManuallyEdited is true, it doesn't set suggestedOdometer
    // Wait, let's look at the hook:
    // } else if (!isActive || !vehicleId) { setSuggestedOdometer(null); }
    // If it's active but manually edited, it just doesn't execute the if block, keeping the initial null or previous value.
    // Since it starts as null, it should be null.
    expect(result.current.suggestedOdometer).toBeNull();
  });
});
