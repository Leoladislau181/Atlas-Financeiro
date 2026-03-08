import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Categoria, TipoLancamento, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, User as UserIcon, Settings, Shield, Tag } from 'lucide-react';

interface ConfiguracoesProps {
  categorias: Categoria[];
  user: User;
  refetch: () => void;
}

export function Configuracoes({ categorias, user, refetch }: ConfiguracoesProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome, tipo })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert([{ user_id: user.id, nome, tipo }]);
        if (error) throw error;
      }

      setNome('');
      setTipo('despesa');
      setEditingId(null);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setNome(cat.nome);
    setTipo(cat.tipo);
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('categorias').delete().eq('id', deletingId);
      if (error) throw error;
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir categoria. Verifique se há lançamentos vinculados.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Senha atualizada com sucesso!');
      setNewPassword('');
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const receitas = categorias.filter((c) => c.tipo === 'receita');
  const despesas = categorias.filter((c) => c.tipo === 'despesa');

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <UserIcon className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle>Dados do Usuário</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={user.email} disabled className="bg-gray-50 text-gray-500" />
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-900">Alterar Senha</h4>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nova Senha</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
                {passwordLoading ? 'Atualizando...' : 'Atualizar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#F59E0B]/10 rounded-lg">
                <Settings className="h-5 w-5 text-[#F59E0B]" />
              </div>
              <CardTitle>{editingId ? 'Editar Categoria' : 'Nova Categoria'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nome da Categoria</label>
                <Input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Alimentação, Salário..."
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento)}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </Select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setNome('');
                      setTipo('despesa');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#D97706]">
                  {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Categoria'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <Tag className="h-5 w-5 text-[#EF4444]" />
              </div>
              <CardTitle className="text-[#EF4444]">Categorias de Despesa</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {despesas.length === 0 ? (
                <li className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed">Nenhuma categoria cadastrada.</li>
              ) : (
                despesas.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">{cat.nome}</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 text-gray-400 hover:text-[#F59E0B] hover:bg-orange-50 rounded-md transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(cat.id)}
                        className="p-1.5 text-gray-400 hover:text-[#EF4444] hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <Tag className="h-5 w-5 text-[#059568]" />
              </div>
              <CardTitle className="text-[#059568]">Categorias de Receita</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {receitas.length === 0 ? (
                <li className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed">Nenhuma categoria cadastrada.</li>
              ) : (
                receitas.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">{cat.nome}</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 text-gray-400 hover:text-[#F59E0B] hover:bg-orange-50 rounded-md transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(cat.id)}
                        className="p-1.5 text-gray-400 hover:text-[#EF4444] hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600">
          Tem certeza que deseja excluir esta categoria? Não será possível excluir se houver lançamentos vinculados a ela.
        </p>
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Confirmar Exclusão
          </Button>
        </div>
      </Modal>
    </div>
  );
}
