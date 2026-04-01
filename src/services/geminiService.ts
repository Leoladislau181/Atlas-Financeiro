import { supabase } from '@/lib/supabase';

export async function parseReceiptImage(base64Image: string, mimeType: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Ocorreu um erro de comunicação com o servidor. Verifique sua conexão e tente novamente.');
  }

  try {
    return await response.json();
  } catch (e) {
    throw new Error('Erro de comunicação com o servidor. Resposta inválida.');
  }
}
