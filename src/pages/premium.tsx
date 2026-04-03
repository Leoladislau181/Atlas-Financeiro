import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Star, Zap, Shield, AlertCircle, CheckCircle2, Copy, Upload, X } from 'lucide-react';
import { User } from '@/types';
import { isPremium, compressImage } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface PremiumProps {
  user: User;
  refetch: () => void;
}

export function Premium({ user, refetch }: PremiumProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isUserPremium = isPremium(user);
  const isPending = user.premium_status === 'pending';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setSuccess(true);
      supabase.auth.refreshSession();
      // Clear the URL parameters to prevent re-triggering on reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('canceled')) {
      setError('O pagamento foi cancelado. Tente novamente quando estiver pronto.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubscribeClick = (plan: 'monthly' | 'yearly') => {
    setSelectedPlan(plan);
    setReceiptFile(null);
    setReceiptPreview(null);
    setError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, envie uma imagem do comprovante.');
      return;
    }

    try {
      setReceiptFile(file);
      const preview = await compressImage(file, 800, 800, 0.8);
      setReceiptPreview(preview);
      setError(null);
    } catch (err) {
      setError('Erro ao processar a imagem.');
    }
  };

  const handleSubmitReceipt = async () => {
    if (!selectedPlan || !receiptPreview || !receiptFile) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Você precisa estar logado para assinar.');

      // Convert base64 preview to blob for upload
      const res = await fetch(receiptPreview);
      const blob = await res.blob();
      
      const fileExt = receiptFile.name.split('.').pop() || 'jpeg';
      const fileName = `${user.id}-receipt-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: receiptFile.type,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error('Erro ao fazer upload do comprovante.');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const response = await fetch('/api/payment/submit-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          plan: selectedPlan,
          receiptUrl: publicUrl
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar comprovante.');

      setSuccess(true);
      setSelectedPlan(null);
      await supabase.auth.refreshSession();
    } catch (err: any) {
      console.error('Erro no envio:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText('65242056000106');
    // Pode adicionar um toast aqui se quiser
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
          <Star className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Atlas <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">Premium</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Desbloqueie todo o potencial do seu negócio. Ferramentas inteligentes para motoristas que querem lucrar mais e gastar menos.
        </p>
      </div>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 mb-8 text-center flex flex-col items-center animate-in zoom-in duration-300">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">Comprovante Enviado!</h2>
          <p className="text-emerald-600 dark:text-emerald-500">
            Seu comprovante foi enviado com sucesso e está em análise. Seu acesso Premium será liberado assim que o pagamento for confirmado.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-8 text-center flex flex-col items-center animate-in shake duration-300">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-400 mb-2">Ops! Algo deu errado</h2>
          <p className="text-red-600 dark:text-red-500">{error}</p>
        </div>
      )}

      {isPending && !success && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 mb-8 text-center">
          <Zap className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-400 mb-2">
            {user.was_premium_before_renewal ? 'Renovação em Análise' : 'Assinatura em Análise'}
          </h2>
          <p className="text-amber-600 dark:text-amber-500">
            Seu comprovante está sendo analisado. Seu acesso será liberado assim que o pagamento for confirmado.
            <br/>
            <span className="text-sm opacity-80 mt-2 block">* Você receberá acesso completo a todas as funcionalidades Premium.</span>
          </p>
        </div>
      )}

      {isUserPremium && !isPending && !success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 mb-8 text-center">
          <Shield className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">Você é Premium!</h2>
          <p className="text-emerald-600 dark:text-emerald-500">
            Seu plano está ativo até {new Date(user.premium_until!).toLocaleDateString('pt-BR')}. Você pode renovar antecipadamente abaixo para somar mais dias à sua assinatura!
          </p>
        </div>
      )}

      {selectedPlan && !success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Pagamento via Pix</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedPlan(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Valor do plano {selectedPlan === 'monthly' ? 'Mensal' : 'Anual'}</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {selectedPlan === 'monthly' ? 'R$ 9,99' : 'R$ 59,99'}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Chave Pix (CNPJ)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-white dark:bg-gray-950 rounded-lg text-center font-mono text-lg border border-gray-200 dark:border-gray-800">
                    65.242.056/0001-06
                  </code>
                  <Button variant="outline" size="icon" onClick={copyPixKey} title="Copiar chave Pix">
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  Após realizar o pagamento, envie o comprovante abaixo para liberar seu acesso imediatamente.
                </p>

                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                {!receiptPreview ? (
                  <Button 
                    variant="outline" 
                    className="w-full h-16 border-dashed border-2 hover:bg-gray-50 dark:hover:bg-gray-900"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Anexar Comprovante
                  </Button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                    <img src={receiptPreview} alt="Comprovante" className="w-full h-40 object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        Trocar Imagem
                      </Button>
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!receiptPreview || loading}
                  onClick={handleSubmitReceipt}
                >
                  {loading ? 'Enviando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Plano Mensal */}
        <Card className="relative overflow-hidden border-2 border-gray-200 dark:border-gray-800 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300">
          <CardContent className="p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Mensal</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Ideal para testar e ter flexibilidade.</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">R$ 9,99</span>
              <span className="text-gray-500 dark:text-gray-400">/mês</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Lançamentos Ilimitados</strong> (O grátis trava em 50/mês)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Leitura de Notas com IA</strong> (Bateu foto, preencheu)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Plano de Manutenção</strong> (Avisos de troca de óleo, etc)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Exportação de Relatórios</strong> (Para contador/IR)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Sistema de Indicação</strong> (Ganhe meses grátis)</span>
              </li>
            </ul>

            <Button 
              onClick={() => handleSubscribeClick('monthly')}
              disabled={isPending || loading}
              className="w-full h-12 text-lg font-semibold bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {isPending ? (user.was_premium_before_renewal ? 'Renovação em Análise' : 'Em Análise') : (isUserPremium ? 'Renovar Mensal' : 'Assinar Mensal')}
            </Button>
          </CardContent>
        </Card>

        {/* Plano Anual */}
        <Card className="relative overflow-hidden border-2 border-amber-500 shadow-xl shadow-amber-500/10 transform md:-translate-y-4">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500"></div>
          <div className="absolute top-4 right-4 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Mais Popular
          </div>
          <CardContent className="p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Anual</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Economize 50% e garanta um ano de tranquilidade.</p>
            </div>
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">R$ 59,99</span>
                <span className="text-gray-500 dark:text-gray-400">/ano</span>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                Equivale a apenas R$ 5,00 por mês!
              </p>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Todos os benefícios do plano Mensal</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Desconto de 50%</strong> (Pague 6, leve 12)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Suporte Prioritário</strong> via WhatsApp</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300"><strong>Acesso antecipado</strong> a novas funcionalidades</span>
              </li>
            </ul>

            <Button 
              onClick={() => handleSubscribeClick('yearly')}
              disabled={isPending || loading}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 border-0"
            >
              {isPending ? (user.was_premium_before_renewal ? 'Renovação em Análise' : 'Em Análise') : (isUserPremium ? 'Renovar Anual' : 'Assinar Anual com Desconto')}
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-16 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pagamento seguro via PIX. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
