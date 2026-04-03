import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { MessageCircle, Plus, Clock, Send, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User, SupportTicket, SupportMessage } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SuporteProps {
  user: User;
  onBack?: () => void;
}

export function Suporte({ user, onBack }: SuporteProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New Ticket State
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Active Ticket State
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTickets();
  }, [user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeTicket) {
      fetchMessages(activeTicket.id);
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      // Subscribe to new messages
      const subscription = supabase
        .channel(`messages:${activeTicket.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${activeTicket.id}`
        }, payload => {
          setMessages(current => {
            if (current.some(m => m.id === payload.new.id)) return current;
            return [...current, payload.new as SupportMessage];
          });
          scrollToBottom();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [activeTicket]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      setError('Erro ao carregar seus chamados.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (err: any) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject || !newMessage) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create Ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: user.id,
          subject: newSubject,
          priority: newPriority,
          status: 'open'
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Create Initial Message
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: ticketData.id,
          user_id: user.id,
          message: newMessage,
          is_admin_reply: false
        }]);

      if (messageError) throw messageError;

      // Success
      setIsNewTicketModalOpen(false);
      setNewSubject('');
      setNewMessage('');
      setNewPriority('normal');
      setShowSuccessBanner(true);
      
      fetchTickets();
      
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 5000);

    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setError(`Erro ao criar o chamado: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    setIsReplying(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: activeTicket.id,
          user_id: user.id,
          message: replyMessage,
          is_admin_reply: false
        }])
        .select()
        .single();

      if (error) throw error;
      
      setMessages(current => {
        if (current.some(m => m.id === data.id)) return current;
        return [...current, data];
      });
      setReplyMessage('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setError(`Erro ao enviar mensagem: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium rounded-full">Aberto</span>;
      case 'in_progress':
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium rounded-full">Em Andamento</span>;
      case 'resolved':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium rounded-full">Resolvido</span>;
      default:
        return null;
    }
  };

  if (activeTicket) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-120px)] flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setActiveTicket(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{activeTicket.subject}</h2>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(activeTicket.status)}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Criado em {format(new Date(activeTicket.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
              <Clock className="h-3.5 w-3.5" />
              Tempo médio de resposta: até 24 horas úteis
            </span>
          </div>

          {messages.map((msg) => {
            const isMe = !msg.is_admin_reply;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-end gap-2 max-w-[85%]">
                  {!isMe && (
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 dark:text-blue-400 text-xs font-bold">AF</span>
                    </div>
                  )}
                  <div 
                    className={`px-4 py-2.5 rounded-2xl ${
                      isMe 
                        ? 'bg-[#059568] text-white rounded-br-sm' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-10">
                  {format(new Date(msg.created_at), "HH:mm")}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="shrink-0 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <form onSubmit={handleReply} className="flex gap-2">
            <Input
              ref={inputRef}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder={activeTicket.status === 'resolved' ? "Este chamado foi resolvido." : "Digite sua mensagem..."}
              disabled={activeTicket.status === 'resolved' || isReplying}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!replyMessage.trim() || activeTicket.status === 'resolved' || isReplying}
              className="bg-[#059568] hover:bg-[#047857] text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Welcome Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left relative">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="absolute top-4 left-4 sm:static sm:top-auto sm:left-auto text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center shrink-0 mx-auto sm:mx-0 mt-8 sm:mt-0">
          <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-300">Central de Suporte</h2>
          <p className="text-sm text-blue-700 dark:text-blue-400/80 mt-1">
            Precisa de ajuda? Abra um chamado e nossa equipe responderá em <strong>até 24 horas úteis</strong>.
          </p>
        </div>
        <Button 
          onClick={() => setIsNewTicketModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {showSuccessBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-400">
            <strong>Sua mensagem foi enviada!</strong> Nossa equipe responderá em até 24 horas úteis. Você receberá um aviso aqui no app assim que tivermos uma atualização.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-800/50 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Tickets List */}
      <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Meus Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando chamados...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Nenhum chamado aberto</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Se tiver alguma dúvida ou problema, clique em "Novo Chamado" acima.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  onClick={() => setActiveTicket(ticket)}
                  className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{ticket.subject}</h4>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Atualizado em {format(new Date(ticket.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
                    Ver Conversa
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Ticket Modal */}
      <Modal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        title="Abrir Novo Chamado"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assunto</label>
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Ex: Dúvida sobre o plano Premium"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Prioridade</label>
            <CustomSelect
              value={newPriority}
              onChange={(val) => setNewPriority(val as any)}
              options={[
                { value: 'low', label: 'Baixa (Dúvidas gerais)' },
                { value: 'normal', label: 'Normal (Problemas comuns)' },
                { value: 'high', label: 'Alta (Sistema fora do ar, pagamentos)' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mensagem</label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-300"
              placeholder="Descreva seu problema com o máximo de detalhes possível..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Lembre-se: nosso tempo médio de resposta é de <strong>até 24 horas úteis</strong>.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsNewTicketModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
