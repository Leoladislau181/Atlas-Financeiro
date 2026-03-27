import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { togglePremiumHandler, getAdminDataHandler } from './admin';
import { Request, Response } from 'express';

// Mock express Request and Response
const mockRequest = (authHeader?: string, body?: any) => {
  return {
    headers: {
      authorization: authHeader,
    },
    body: body || {},
  } as Request;
};

const mockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Admin API Handlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('togglePremiumHandler', () => {
    it('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      // Setup environment
      process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Re-import the module to pick up the new env vars
      const { togglePremiumHandler: handler } = await import('./admin');

      const req = mockRequest('Bearer valid_token', { targetUserId: '123' });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Chave de serviço do Supabase (SUPABASE_SERVICE_ROLE_KEY) não configurada no servidor.' 
      });
    });
  });

  describe('getAdminDataHandler', () => {
    it('should return 500 if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      // Setup environment
      process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Re-import the module to pick up the new env vars
      const { getAdminDataHandler: handler } = await import('./admin');

      const req = mockRequest('Bearer valid_token');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Chave de serviço do Supabase (SUPABASE_SERVICE_ROLE_KEY) não configurada no servidor.' 
      });
    });
  });
});
