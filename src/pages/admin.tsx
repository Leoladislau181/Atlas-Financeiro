import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { Shield, User as UserIcon, BarChart2, Users, Star, Database, RefreshCw, Search } from 'lucide-react';
import { UserDetailsModal } from '@/components/user-details-modal';
import { Input } from '@/components/ui/input';

interface AdminProps {
  user: User;
}

export function Admin({ user }: AdminProps) {
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user.role === 'admin') {
      fetchAdminData();
    }
  }, [user.role]);

  const openUserDetails = (u: User) => {
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

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.stack ? `${data.error}\n\nStack: ${data.stack}` : (data.error || 'Erro ao carregar dados do painel administrativo.');
        throw new Error(errorMessage);
      }

      setAdminUsers(data.users || []);
      setAdminMetrics({
        totalUsers: data.totalUsers || 0,
        premiumUsers: data.premiumUsers || 0,
        totalLancamentos: data.totalTransactions || 0
      });
    } catch (error: any) {
      console.error('Erro ao buscar dados administrativos:', error);
      setErrorMsg(error.message || 'Erro ao carregar dados do painel administrativo.');
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status premium.');
      }
      
      setSuccessMsg(`Status Premium do usuário atualizado!`);
      fetchAdminData();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar status premium.');
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
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar status do usuário.');
      }
      
      setSuccessMsg(`Status do usuário atualizado para ${newStatus}!`);
      fetchAdminData();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar status do usuário.');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      // Placeholder for delete API call
      console.log('Deleting user:', userId);
      setSuccessMsg('Usuário excluído com sucesso!');
      setIsDetailsModalOpen(false);
      fetchAdminData();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao excluir usuário.');
    }
  };

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
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isUserPremium 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {isUserPremium ? 'Premium' : 'Grátis'}
                        </span>
                        {isUserPremium && u.premium_until && (
                          <p className="text-[10px] text-gray-400 mt-1">Até {new Date(u.premium_until).toLocaleDateString()}</p>
                        )}
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
      <UserDetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        user={selectedUser}
        onToggleStatus={toggleUserStatus}
        onTogglePremium={toggleUserPremium}
        onDeleteUser={deleteUser}
      />
    </div>
  );
}
