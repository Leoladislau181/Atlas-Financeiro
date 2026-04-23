import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/custom-select';
import { Modal } from '@/components/ui/modal';
import { Categoria, TipoLancamento, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2, Tag, ArrowLeft, X, Lock, Settings } from 'lucide-react';
import { isPremium } from '@/lib/utils';

interface CategoriasPageProps {
  categorias: Categoria[];
  user: User;
  refetch: () => void;
  onBackToConfig: () => void;
  onBackToHome: () => void;
  onNavigateToPremium?: () => void;
  forceOpenAdd?: boolean;
}

export function CategoriasPage({ 
  categorias, 
  user, 
  refetch, 
  onBackToConfig, 
  onBackToHome,
  onNavigateToPremium,
  forceOpenAdd = false
}: CategoriasPageProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoLancamento | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(forceOpenAdd);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (forceOpenAdd) {
      setIsAddModalOpen(true);
    }
  }, [forceOpenAdd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    if (!tipo) {
      setErrorMsg('Por favor, selecione se a categoria é de Despesa ou Receita.');
      return;
    }

    if (!isPremium(user)) {
      const customCategoriesCount = categorias.filter(c => !c.is_system_default).length;
      if (customCategoriesCount >= 5) {
        if (onNavigateToPremium) onNavigateToPremium();
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('categorias')
        .insert([{ user_id: user.id, nome, tipo }]);
      if (error) throw error;

      setNome('');
      setTipo('');
      setIsAddModalOpen(false);
      
      // Pequeno delay para garantir que o refetch aconteça com o modal já fechado visualmente
      setTimeout(() => {
        refetch();
      }, 100);
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao criar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (cat: Categoria) => {
    if (!editNome) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('categorias')
        .update({ nome: editNome })
        .eq('id', cat.id);
      if (error) throw error;

      setEditingId(null);
      setEditNome('');
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setEditNome(cat.nome);
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
      setErrorMsg(error.message || 'Erro ao excluir categoria. Verifique se há lançamentos vinculados.');
    }
  };

  const receitas = categorias.filter((c) => c.tipo === 'receita');
  const despesas = categorias.filter((c) => c.tipo === 'despesa');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between -mb-2 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm sm:shadow-none sm:bg-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBackToConfig}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Categorias</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBackToHome}
          className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-xl text-sm flex justify-between items-center">
          <span>{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg('')}>OK</Button>
        </div>
      )}

      {/* Intro and Create Button */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-[#F59E0B]/10 rounded-2xl">
            <Tag className="h-8 w-8 text-[#F59E0B]" />
          </div>
        </div>
        <div className="max-w-md mx-auto">
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            Crie categorias para organizar seu controle financeiro. Exemplos: <span className="font-medium text-gray-900 dark:text-gray-100">"Hamburgueria"</span>, <span className="font-medium text-gray-900 dark:text-gray-100">"Uber"</span>, <span className="font-medium text-gray-900 dark:text-gray-100">"Supermercado"</span> ou <span className="font-medium text-gray-900 dark:text-gray-100">"Lazer"</span>.
          </p>
        </div>
        <Button 
          onClick={() => {
            setNome('');
            setTipo('');
            setIsAddModalOpen(true);
          }}
          className="bg-[#F59E0B] hover:bg-[#D97706] text-white px-8 h-12 rounded-xl font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Criar Categoria
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-4 border-b border-gray-50 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-50 dark:bg-[#EF4444]/20 rounded-lg">
                <Tag className="h-5 w-5 text-[#EF4444] dark:text-[#F87171]" />
              </div>
              <CardTitle className="text-[#EF4444] dark:text-[#F87171]">Categorias de Despesa</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {despesas.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma categoria cadastrada.</li>
              ) : (
                despesas.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input 
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="h-9 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(cat);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleUpdate(cat)} className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 p-0">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-500 h-9 w-9 p-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                          {cat.is_system_default && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">Padrão</span>
                          )}
                        </div>
                        {!cat.is_system_default && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(cat)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#F59E0B] dark:hover:text-[#FBBF24] hover:bg-orange-50 dark:hover:bg-[#F59E0B]/10 rounded-md transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(cat.id)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#EF4444] dark:hover:text-[#F87171] hover:bg-red-50 dark:hover:bg-[#EF4444]/10 rounded-md transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-4 border-b border-gray-50 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 dark:bg-[#10B981]/20 rounded-lg">
                <Tag className="h-5 w-5 text-[#059568] dark:text-[#10B981]" />
              </div>
              <CardTitle className="text-[#059568] dark:text-[#10B981]">Categorias de Receita</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {receitas.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed dark:border-gray-700">Nenhuma categoria cadastrada.</li>
              ) : (
                receitas.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input 
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="h-9 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(cat);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleUpdate(cat)} className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 p-0">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-500 h-9 w-9 p-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.nome}</span>
                          {cat.is_system_default && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">Padrão</span>
                          )}
                        </div>
                        {!cat.is_system_default && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(cat)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#F59E0B] dark:hover:text-[#FBBF24] hover:bg-orange-50 dark:hover:bg-[#F59E0B]/10 rounded-md transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(cat.id)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#EF4444] dark:hover:text-[#F87171] hover:bg-red-50 dark:hover:bg-[#EF4444]/10 rounded-md transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Adicionar Categoria"
        className="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nome da Categoria</label>
              <Input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Alimentação, Salário..."
                className="h-12 text-base rounded-xl border-gray-200 dark:border-gray-800"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tipo da Categoria</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo('despesa')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                    tipo === 'despesa'
                      ? 'border-[#EF4444] bg-red-50 dark:bg-red-900/20 text-[#EF4444]'
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 hover:border-red-200 dark:hover:border-red-900/40'
                  }`}
                >
                  <Tag className="h-6 w-6" />
                  <span className="font-bold text-sm">Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('receita')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                    tipo === 'receita'
                      ? 'border-[#10B981] bg-emerald-50 dark:bg-emerald-900/20 text-[#10B981]'
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 hover:border-emerald-200 dark:hover:border-emerald-900/40'
                  }`}
                >
                  <Tag className="h-6 w-6" />
                  <span className="font-bold text-sm">Receita</span>
                </button>
              </div>
              {!tipo && <p className="text-[10px] text-red-500 mt-1">* Seleção obrigatória</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsAddModalOpen(false)}
              className="flex-1 h-12 rounded-xl text-gray-500"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !tipo} 
              className="flex-1 h-12 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold"
            >
              {loading ? 'Salvando...' : 'Criar Categoria'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir Categoria"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
