import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Star, Shield, TrendingUp, Search, Check, X, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    admins: 0,
    totalLancamentos: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch users from profiles
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (pError) throw pError;
      setUsers(profiles || []);

      // 2. Fetch stats
      const { count: totalLancamentos } = await supabase
        .from('lancamentos')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: profiles?.length || 0,
        premiumUsers: profiles?.filter(p => p.premium_until && new Date(p.premium_until) > new Date()).length || 0,
        admins: profiles?.filter(p => p.role === 'admin').length || 0,
        totalLancamentos: totalLancamentos || 0
      });
    } catch (err) {
      console.error('Erro ao buscar dados admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePremium = async (userId: string, currentPremiumUntil: string | null) => {
    const newPremiumUntil = currentPremiumUntil && new Date(currentPremiumUntil) > new Date()
      ? null
      : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ premium_until: newPremiumUntil })
        .eq('id', userId);

      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao atualizar premium:', err);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    // Antigravidade: Don't let admin remove their own admin status easily if you want, 
    // but here we just follow the change.
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Painel Administrativo</h2>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
           <TrendingUp className="h-4 w-4" /> Atualizar Dados
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Usuários</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Usuários Premium</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.premiumUsers}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Administradores</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.admins}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Lançamentos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLancamentos}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="border-none shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
        <CardHeader className="border-b border-gray-50 dark:border-gray-800 flex flex-row items-center justify-between space-y-0 p-6">
          <CardTitle className="text-lg font-semibold">Gerenciar Usuários</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar por nome ou email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-gray-50 dark:bg-gray-800 border-none"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Permissão</th>
                <th className="px-6 py-4">Criado em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-amber-500"></div>
                      <span>Carregando usuários...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUserPremium = u.premium_until && new Date(u.premium_until) > new Date();
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                            {u.foto_url ? (
                              <img src={u.foto_url} alt={u.nome} className="h-full w-full object-cover" />
                            ) : (
                              u.nome ? u.nome.charAt(0).toUpperCase() : <Users className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-semibold text-gray-900 dark:text-white truncate">
                              {u.nome || 'Sem nome'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" /> {u.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isUserPremium ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Star className="h-3 w-3 fill-amber-500" /> Premium
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Free
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy', { locale: ptBR }) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => togglePremium(u.id, u.premium_until)}
                            className={isUserPremium ? "text-amber-600 border-amber-200" : ""}
                          >
                            {isUserPremium ? <X className="h-3.5 w-3.5 mr-1" /> : <Star className="h-3.5 w-3.5 mr-1" />}
                            {isUserPremium ? 'Remover Premium' : 'Tornar Premium'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleRole(u.id, u.role)}
                            className="text-gray-500 hover:text-purple-600"
                          >
                            {u.role === 'admin' ? 'Tornar User' : 'Tornar Admin'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
