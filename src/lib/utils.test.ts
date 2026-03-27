import { describe, it, expect } from 'vitest';
import { 
  formatCurrency, 
  parseCurrency, 
  formatCurrencyInput, 
  parseLocalDate, 
  isPremium 
} from './utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format numbers to BRL currency', () => {
      // The exact output depends on Node's Intl implementation, 
      // but it should contain the value and currency symbol.
      const result = formatCurrency(1500.5);
      expect(result).toContain('1.500,50');
      expect(result).toContain('R$');
    });
  });

  describe('parseCurrency', () => {
    it('should parse formatted currency string to number', () => {
      expect(parseCurrency('R$ 1.500,50')).toBe(1500.5);
      expect(parseCurrency('150050')).toBe(1500.5);
      expect(parseCurrency('0,00')).toBe(0);
    });
  });

  describe('formatCurrencyInput', () => {
    it('should format raw string input to currency', () => {
      const result = formatCurrencyInput('150050');
      expect(result).toContain('1.500,50');
      expect(result).toContain('R$');
    });

    it('should return empty string for empty input', () => {
      expect(formatCurrencyInput('')).toBe('');
    });
  });

  describe('parseLocalDate', () => {
    it('should parse YYYY-MM-DD to a local Date object', () => {
      const date = parseLocalDate('2023-10-15');
      expect(date.getFullYear()).toBe(2023);
      expect(date.getMonth()).toBe(9); // 0-indexed, so 9 is October
      expect(date.getDate()).toBe(15);
    });
  });

  describe('isPremium', () => {
    it('should return false if user is null', () => {
      expect(isPremium(null)).toBe(false);
    });

    it('should return false if premium_until is missing', () => {
      expect(isPremium({ id: '1', email: 'test@test.com' } as any)).toBe(false);
    });

    it('should return true if premium_until is in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      expect(isPremium({ 
        id: '1', 
        email: 'test@test.com', 
        premium_until: futureDate.toISOString() 
      } as any)).toBe(true);
    });

    it('should return false if premium_until is in the past', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      expect(isPremium({ 
        id: '1', 
        email: 'test@test.com', 
        premium_until: pastDate.toISOString() 
      } as any)).toBe(false);
    });
  });
});
