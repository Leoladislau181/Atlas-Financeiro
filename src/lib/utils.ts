import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Vehicle, Lancamento } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Retorna o ID do veículo mais utilizado pelo usuário baseado na quilometragem percorrida no sistema.
 * Critério de desempate: veículo cadastrado por último.
 */
export function getMostUsedVehicleId(vehicles: Vehicle[], lancamentos: Lancamento[]): string {
  if (vehicles.length === 0) return '';
  if (vehicles.length === 1) return vehicles[0].id;

  const usageByVehicle = vehicles.map(v => {
    const vLancamentos = lancamentos.filter(l => l.vehicle_id === v.id);
    
    // Calcula a distância total percorrida (Max Odo - Min Odo)
    const odos = vLancamentos
      .map(l => l.odometer || l.odometro_receita || 0)
      .filter(o => o > 0);
    
    let distance = 0;
    if (odos.length > 0) {
      const allReferenceOdos = [...odos, v.initial_odometer || 0];
      const maxOdo = Math.max(...allReferenceOdos);
      const minOdo = Math.min(...allReferenceOdos);
      distance = maxOdo - minOdo;
    }
    
    // Também considera km_rodados explícitos se houver
    const explicitKm = vLancamentos.reduce((acc, l) => acc + (l.km_rodados || 0), 0);
    
    return {
      id: v.id,
      distance: Math.max(distance, explicitKm),
      createdAt: new Date(v.created_at).getTime()
    };
  });

  // Ordena por distância (desc) e depois por data de criação (desc - registrados por último)
  usageByVehicle.sort((a, b) => {
    if (b.distance !== a.distance) {
      return b.distance - a.distance;
    }
    return b.createdAt - a.createdAt;
  });

  return usageByVehicle[0].id;
}

export function isPremium(user: User | null | undefined): boolean {
  if (!user) return false;
  if (!user.premium_until) return false;
  const premiumUntil = new Date(user.premium_until);
  return premiumUntil > new Date();
}

export function isPremiumFull(user: User | null | undefined): boolean {
  if (!isPremium(user)) return false;
  if (user?.premium_status === 'pending' && user?.was_premium_before_renewal) {
    return true;
  }
  return user?.premium_status !== 'pending';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function parseCurrency(value: string): number {
  const cleanValue = value.replace(/\D/g, '');
  return Number(cleanValue) / 100;
}

export function formatCurrencyInput(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue) return '';
  const numberValue = Number(cleanValue) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
}

export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function compressImage(file: File, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao carregar a imagem.'));
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
  });
}
