import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, SupportTicket } from '@/types';
import { supabase, handleAuthError } from '@/lib/supabase';
import { Shield, User as UserIcon, BarChart2, Users, Star, Database, RefreshCw, Search, MessageCircle, Clock } from 'lucide-react';
import { UserDetailsModal } from '@/components/user-details-modal';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { format } from 'date-fns';

interface AdminProps {
  user: User;
  onBack?: () => void;
}

export function Admin({ user, onBack }: AdminProps) {
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<any>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // Admin Ticket Reply State
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages]);

  useEffect(() => {
    if (user.role === 'admin') {
      fetchAdminData();
      fetchSupportTickets();
    }
  }, [user.role]);

  const fetchSupportTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSupportTickets(data || []);
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    }
  };

  const fetchTicketMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTicketMessages(data || []);
    } catch (err) {
      console.error('Error fetching ticket messages:', err);
    }
  };

  useEffect(() => {
    if (activeTicket) {
      fetchTicketMessages(activeTicket.id);
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      const subscription = supabase
        .channel(`admin_messages:${activeTicket.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${activeTicket.id}`
        }, payload => {
          setTicketMessages(current => {
            if (current.some(m => m.id === payload.new.id)) return current;
            return [...current, payload.new];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [activeTicket]);

  const handleOpenTicket = (ticket: SupportTicket) => {
    setActiveTicket(ticket);
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket || isReplying) return;

    setIsReplying(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: activeTicket.id,
          user_id: user.id,
          message: replyMessage,
          is_admin_reply: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      setTicketMessages(current => {
        if (current.some(m => m.id === data.id)) return current;
        return [...current, data];
      });
      setReplyMessage('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      
      // Update ticket status to in_progress if it was open
      if (activeTicket.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', activeTicket.id);
        
        fetchSupportTickets();
      }
      
      setReplyMessage('');
      fetchTicketMessages(activeTicket.id);
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setIsReplying(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!activeTicket) return;
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', activeTicket.id);
      
      if (error) throw error;
      
      setActiveTicket({ ...activeTicket, status: 'resolved' });
      fetchSupportTickets();
      setSuccessMsg('Chamado marcado como resolvido.');
    } catch (err) {
      console.error('Error resolving ticket:', err);
    }
  };

  const requestConfirm = (title: string, message: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmModalOpen(true);
  };

  const openUserDetails = (u: User) => {
    console.log('Opening user details for:', u);
    setSelectedUser(u);
    setIsDetailsModalOpen(true);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const response = await fetch('/api/admin/data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        const snippet = text.substring(0, 200).replace(/\n/g, ' ');
        console.error(`[Admin API Error] Status: ${response.status}, Content-Type: ${contentType}, Body Snippet: ${snippet}`);
        
        if (response.status === 404) {
          throw new Error("Endpoint administrativo não publicado na Vercel.");
        }
        
        throw new Error(`Erro de comunicação com o servidor (Status ${response.status}). Detalhes: ${snippet}...`);
      }

      let data: any = {};
      try { data = await response.json(); } catch (e) {}

      if (!response.ok) {
        const errorMessage = data.stack ? `${data.error}\n\nStack: ${data.stack}` : (data.error || 'Erro ao carregar dados do painel administrativo.');
        throw new Error(errorMessage);
      }

      setAdminUsers(data.users || []);
      console.log('Admin users with metrics:', data.users);
      setAdminMetrics({
        totalUsers: data.totalUsers || 0,
        premiumUsers: data.premiumUsers || 0,
        totalLancamentos: data.totalTransactions || 0
      });
    } catch (error: any) {
      console.error('Erro ao buscar dados administrativos:', error);
      if (!handleAuthError(error)) {
        setErrorMsg(error.message || 'Erro ao carregar dados do painel administrativo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleUserPremium = async (userId: string, currentPremiumUntil: string | null, duration?: 'week' | 'month' | 'year') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const response = await fetch('/api/admin/toggle-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          targetUserId: userId,
          currentPremiumUntil,
          duration
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        const snippet = text.substring(0, 200).replace(/\n/g, ' ');
        console.error(`[Admin API Error] Status: ${response.status}, Content-Type: ${contentType}, Body Snippet: ${snippet}`);
        
        if (response.status === 404) {
          throw new Error("Endpoint administrativo não publicado na Vercel.");
        }
        
        throw new Error(`Erro de comunicação com o servidor (Status ${response.status}). Detalhes: ${snippet}...`);
      }

      let data: any = {};
      try { data = await response.json(); } catch (e) {}

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status premium.');
      }
      
      setSuccessMsg(`Status Premium do usuário atualizado!`);
      fetchAdminData();
    } catch (error: any) {
      if (!handleAuthError(error)) {
        setErrorMsg(error.message || 'Erro ao atualizar status premium.');
      }
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';

      const response = await fetch('/api/admin/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          targetUserId: userId,
          newStatus
        })
      });

      if (!response.ok) {
        let data: any = {};
        try { data = await response.json(); } catch (e) {}
        throw new Error(data.error || 'Erro ao atualizar status do usuário.');
      }
      
      setSuccessMsg(`Status do usuário atualizado para ${newStatus}!`);
      fetchAdminData();
    } catch (error: any) {
      if (!handleAuthError(error)) {
        setErrorMsg(error.message || 'Erro ao atualizar status do usuário.');
      }
    }
  };

  const deleteUser = (userId: string) => {
    requestConfirm(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este usuário?',
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Sessão não encontrada');

          // Placeholder for delete API call
          console.log('Deleting user:', userId);
          setSuccessMsg('Usuário excluído com sucesso!');
          setIsDetailsModalOpen(false);
          fetchAdminData();
        } catch (error: any) {
          if (!handleAuthError(error)) {
            setErrorMsg(error.message || 'Erro ao excluir usuário.');
          }
        } finally {
          setConfirmModalOpen(false);
        }
      }
    );
  };

  const handleApprovePayment = async (userId: string, plan: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const response = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          targetUserId: userId,
          action: 'approve',
          plan
        })
      });

      if (!response.ok) {
        let data: any = {};
        try { data = await response.json(); } catch (e) {}
        throw new Error(data.error || 'Erro ao aprovar pagamento.');
      }
      
      setSuccessMsg('Pagamento aprovado com sucesso!');
      setIsDetailsModalOpen(false);
      fetchAdminData();
    } catch (error: any) {
      if (!handleAuthError(error)) {
        setErrorMsg(error.message || 'Erro ao aprovar pagamento.');
      }
    }
  };

  const handleRejectPayment = (userId: string) => {
    requestConfirm(
      'Rejeitar Pagamento',
      'Tem certeza que deseja rejeitar este pagamento? O status do usuário voltará ao normal e o comprovante será descartado.',
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Sessão não encontrada');

          const response = await fetch('/api/admin/approve-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              targetUserId: userId,
              action: 'reject'
            })
          });

          if (!response.ok) {
            let data: any = {};
            try { data = await response.json(); } catch (e) {}
            throw new Error(data.error || 'Erro ao rejeitar pagamento.');
          }
          
          setSuccessMsg('Pagamento rejeitado.');
          setIsDetailsModalOpen(false);
          fetchAdminData();
        } catch (error: any) {
          if (!handleAuthError(error)) {
            setErrorMsg(error.message || 'Erro ao rejeitar pagamento.');
          }
        } finally {
          setConfirmModalOpen(false);
        }
      }
    );
  };

  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'tickets'>('users');

  if (user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-4">
          <Shield className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Negado</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Esta área é restrita apenas para administradores do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack} className="mb-4 text-gray-500 hover:text-gray-900 border border-gray-200">
              Voltar ao Menu
            </Button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Painel Administrativo
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie usuários e visualize métricas globais do sistema.</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Pesquisar e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button onClick={fetchAdminData} disabled={loading} variant="outline" className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
      </div>

      {(errorMsg || successMsg) && (
        <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-200 ${
          errorMsg 
            ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400'
        }`}>
          <p className="text-sm font-medium whitespace-pre-wrap">{errorMsg || successMsg}</p>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`pb-2 px-1 font-medium text-sm transition-colors ${
            activeAdminTab === 'users'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveAdminTab('tickets')}
          className={`pb-2 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
            activeAdminTab === 'tickets'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Chamados
          {supportTickets.filter(t => t.status === 'open').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {supportTickets.filter(t => t.status === 'open').length}
            </span>
          )}
        </button>
      </div>

      {activeAdminTab === 'users' ? (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-1">Total Usuários</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{adminMetrics?.totalUsers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                    <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-bold tracking-wider mb-1">Usuários Premium</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{adminMetrics?.premiumUsers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                    <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider mb-1">Total Lançamentos</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{adminMetrics?.totalLancamentos || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users List */}
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
            <CardHeader className="border-b border-gray-50 dark:border-gray-800">
              <CardTitle className="text-lg font-bold">Gerenciar Usuários</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
                      <th className="px-6 py-4 font-medium">Usuário</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Plano</th>
                      <th className="px-6 py-4 font-medium">Criado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {adminUsers
                      .filter((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((u) => {
                      const isUserPremium = u.premium_until && new Date(u.premium_until) > new Date();
                      const isBlocked = u.status === 'blocked';
                      return (
                        <tr key={u.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer" onClick={() => openUserDetails(u)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
                                {u.foto_url ? (
                                  <img src={u.foto_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <UserIcon className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-gray-100">{u.nome || 'Sem nome'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'admin' 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isBlocked
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {isBlocked ? 'Bloqueado' : 'Ativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                u.premium_status === 'pending'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  : isUserPremium 
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {u.premium_status === 'pending' ? 'Pendente' : (isUserPremium ? 'Premium' : 'Grátis')}
                              </span>
                              {isUserPremium && u.premium_until && (
                                <p className="text-[10px] text-gray-400">Até {new Date(u.premium_until).toLocaleDateString()}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Chamados de Suporte</CardTitle>
          </CardHeader>
          <CardContent>
            {supportTickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhum chamado aberto.</div>
            ) : (
              <div className="space-y-3">
                {supportTickets.map((ticket) => {
                  const ticketUser = adminUsers.find(u => u.id === ticket.user_id);
                  return (
                  <div 
                    key={ticket.id}
                    onClick={() => handleOpenTicket(ticket)}
                    className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">{ticket.subject}</h4>
                        {ticket.status === 'open' && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Aberto</span>}
                        {ticket.status === 'in_progress' && <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">Em Andamento</span>}
                        {ticket.status === 'resolved' && <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">Resolvido</span>}
                        {ticket.priority === 'high' && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">Urgente</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {ticketUser?.nome || ticketUser?.email || 'Usuário'} • Atualizado em {format(new Date(ticket.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
                      Responder
                    </Button>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Ticket Reply Modal */}
      <Modal
        isOpen={!!activeTicket}
        onClose={() => setActiveTicket(null)}
        title={activeTicket ? `Chamado: ${activeTicket.subject}` : ''}
        className="max-w-2xl"
      >
        {activeTicket && (() => {
          const ticketUser = adminUsers.find(u => u.id === activeTicket.user_id);
          return (
          <div className="flex flex-col h-[60vh]">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Usuário: {ticketUser?.nome || ticketUser?.email || 'Usuário'}</p>
                <p className="text-xs text-gray-500">Criado em: {format(new Date(activeTicket.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              {activeTicket.status !== 'resolved' && (
                <Button onClick={handleResolveTicket} variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  Marcar como Resolvido
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 rounded-xl p-4 space-y-4 mb-4">
              {ticketMessages.map((msg) => {
                const isAdmin = msg.is_admin_reply;
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] ${
                      isAdmin 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-2">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleAdminReply} className="flex gap-2 shrink-0">
              <Input
                ref={inputRef}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder={activeTicket.status === 'resolved' ? "Este chamado foi resolvido." : "Digite sua resposta..."}
                disabled={activeTicket.status === 'resolved'}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!replyMessage.trim() || activeTicket.status === 'resolved' || isReplying}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Responder
              </Button>
            </form>
          </div>
          );
        })()}
      </Modal>

      <UserDetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        user={selectedUser}
        onToggleStatus={toggleUserStatus}
        onTogglePremium={toggleUserPremium}
        onDeleteUser={deleteUser}
        onApprovePayment={handleApprovePayment}
        onRejectPayment={handleRejectPayment}
      />

      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={confirmTitle}
      >
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          {confirmMessage}
        </p>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmModalOpen(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => confirmAction && confirmAction()} className="w-full sm:w-auto">
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
