import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseReceiptHandler } from './parse-receipt';
import { Request, Response } from 'express';
import * as supabaseJs from '@supabase/supabase-js';

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

// Mock Supabase Client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(),
  };
});

describe('Parse Receipt API Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  const setupSupabaseMock = (user: any, profile: any, usageCount: number) => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: profile, error: null }),
          };
        }
        if (table === 'receipt_usage') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { count: usageCount }, error: null }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
    (supabaseJs.createClient as any).mockReturnValue(mockSupabase);
    return mockSupabase;
  };

  it('should block invalid MIME types', async () => {
    setupSupabaseMock({ id: 'user-123' }, { premium_until: null }, 0);

    const req = mockRequest('Bearer valid_token', {
      base64Image: 'valid_base64_string_that_is_long_enough_to_pass_validation',
      mimeType: 'application/pdf', // Invalid MIME
    });
    const res = mockResponse();

    await parseReceiptHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ 
      error: 'Formato de imagem não suportado. Por favor, envie uma imagem JPG, PNG ou WEBP.' 
    });
  });

  it('should respect daily limit for free users', async () => {
    // Setup free user with 5 existing usages (limit is 5)
    setupSupabaseMock({ id: 'user-123' }, { premium_until: null }, 5);

    const req = mockRequest('Bearer valid_token', {
      base64Image: 'valid_base64_string',
      mimeType: 'image/jpeg',
    });
    const res = mockResponse();

    await parseReceiptHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ 
      error: expect.stringContaining('Você atingiu o limite de leitura de recibos por hoje (5 recibos)') 
    });
  });

  it('should respect daily limit for premium users', async () => {
    // Setup premium user with 50 existing usages (limit is 50)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    setupSupabaseMock({ id: 'user-123' }, { premium_until: futureDate.toISOString() }, 50);

    const req = mockRequest('Bearer valid_token', {
      base64Image: 'valid_base64_string',
      mimeType: 'image/jpeg',
    });
    const res = mockResponse();

    await parseReceiptHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ 
      error: expect.stringContaining('Você atingiu o limite de leitura de recibos por hoje (50 recibos)') 
    });
  });
});
