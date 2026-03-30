import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isPremium(user: User | null | undefined): boolean {
  if (!user) return false;
  if (!user.premium_until) return false;
  const premiumUntil = new Date(user.premium_until);
  return premiumUntil > new Date();
}

export function isPremiumFull(user: User | null | undefined): boolean {
  if (!isPremium(user)) return false;
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
