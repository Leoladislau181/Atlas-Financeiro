import { Request, Response } from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createPreferenceHandler = async (req: Request, res: Response) => {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurada no servidor.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const token = authHeader.split(' ')[1];
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const { plan } = req.body;
    const isYearly = plan === 'yearly';
    const amount = isYearly ? 99.90 : 14.90; // R$ 99,90 or R$ 14,90
    const planName = isYearly ? 'Atlas Premium Anual' : 'Atlas Premium Mensal';

    const preference = new Preference(client);
    
    const response = await preference.create({
      body: {
        items: [
          {
            id: plan,
            title: planName,
            description: isYearly ? 'Acesso premium por 1 ano' : 'Acesso premium por 1 mês',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: amount,
          }
        ],
        payer: {
          email: user.email,
        },
        back_urls: {
          success: `${process.env.APP_URL}/premium?success=true`,
          failure: `${process.env.APP_URL}/premium?canceled=true`,
          pending: `${process.env.APP_URL}/premium?pending=true`,
        },
        auto_return: 'approved',
        external_reference: user.id,
        metadata: {
          plan: plan,
          userId: user.id
        }
      }
    });

    // Return the init_point (checkout URL)
    return res.status(200).json({ url: response.init_point });
  } catch (error: any) {
    console.error('Erro ao criar preferência do Mercado Pago:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const mercadoPagoWebhookHandler = async (req: Request, res: Response) => {
  // Mercado Pago sends the event type and data in the body or query params
  // Usually, it's a POST to the webhook URL with `type` or `topic` and `data.id`
  const { type, data, action } = req.body;
  const topic = req.query.topic || req.query.type || type;
  const id = req.query['data.id'] || data?.id;

  try {
    // We only care about payment updates
    if (topic === 'payment' && id) {
      // Fetch the payment to verify its status
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      });
      
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        
        if (paymentData.status === 'approved') {
          const userId = paymentData.external_reference || paymentData.metadata?.user_id;
          const plan = paymentData.metadata?.plan;

          if (userId) {
            const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
              auth: { autoRefreshToken: false, persistSession: false }
            });

            // Calculate premium until date
            const premiumUntil = new Date();
            if (plan === 'yearly') {
              premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
            } else {
              premiumUntil.setMonth(premiumUntil.getMonth() + 1);
            }

            const { error } = await supabaseAdmin
              .from('profiles')
              .update({ premium_until: premiumUntil.toISOString() })
              .eq('id', userId);

            if (error) {
              console.error('Erro ao atualizar premium via webhook:', error);
              return res.status(500).json({ error: 'Erro ao atualizar perfil' });
            }
            
            console.log(`Usuário ${userId} atualizado para Premium com sucesso via Mercado Pago.`);
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(500).send(`Webhook Error: ${err.message}`);
  }
};
