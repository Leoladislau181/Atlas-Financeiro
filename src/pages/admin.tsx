import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Users, Star, Search, CheckCircle, XCircle } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar usuários');
      }
      
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGrantPremium = async (userId: string, months: number) => {
    try {
      const premiumUntil = addMonths(new Date(), months).toISOString();
      const response = await fetch(`/api/admin/users/${userId}/premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premium_until: premiumUntil })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao conceder premium');
      }
      
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemovePremium = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premium_until: null })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao remover premium');
      }
      
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(search.toLowerCase()) || 
    (u.nome || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.premium_until && new Date(u.premium_until) > new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-500" />
          Painel Administrativo
        </h2>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <XCircle className="h-6 w-6" />
              <div>
                <h3 className="font-bold">Acesso Restrito ou Erro</h3>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-2 opacity-80">
                  Dica: Verifique se a variável SUPABASE_SERVICE_ROLE_KEY está configurada nos Secrets do AI Studio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Usuários</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalUsers}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-[#F59E0B]/10 rounded-xl">
                  <Star className="h-6 w-6 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Usuários Premium</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{premiumUsers}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-white dark:bg-gray-900">
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg">Gerenciamento de Usuários</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Buscar por nome ou email..." 
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Carregando usuários...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3 font-medium">Usuário</th>
                        <th className="px-6 py-3 font-medium">Cadastro</th>
                        <th className="px-6 py-3 font-medium">Status Premium</th>
                        <th className="px-6 py-3 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredUsers.map((u) => {
                        const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
                        return (
                          <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {u.foto_url ? (
                                  <img src={u.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {u.nome?.charAt(0) || u.email?.charAt(0) || '?'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{u.nome || 'Sem nome'}</div>
                                  <div className="text-xs text-gray-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                            </td>
                            <td className="px-6 py-4">
                              {isPremium ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F59E0B]/10 text-[#D97706] dark:text-[#FBBF24]">
                                  <Star className="h-3 w-3 fill-current" />
                                  Até {format(new Date(u.premium_until), "dd/MM/yyyy")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  Gratuito
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              {isPremium ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRemovePremium(u.id)}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  Remover Premium
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleGrantPremium(u.id, 12)}
                                  className="text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/10"
                                >
                                  Dar Premium (1 ano)
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            Nenhum usuário encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
