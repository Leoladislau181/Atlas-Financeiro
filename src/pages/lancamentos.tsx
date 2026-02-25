import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatCurrencyInput, parseCurrency, parseLocalDate } from '@/lib/utils';
import { Categoria, Lancamento, TipoLancamento } from '@/types';
import { supabase } from '@/lib/supabase';
import { Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface LancamentosProps {
  categorias: Categoria[];
  lancamentos: Lancamento[];
  refetch: () => void;
  userId: string;
}

export function Lancamentos({ categorias, lancamentos, refetch, userId }: LancamentosProps) {
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [categoriaId, setCategoriaId] = useState('');
  const [valorStr, setValorStr] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredCategorias = categorias.filter((c) => c.tipo === tipo);

  useEffect(() => {
    const validCategory = filteredCategorias.find(c => c.id === categoriaId);
    if (!validCategory && filteredCategorias.length > 0) {
      setCategoriaId(filteredCategorias[0].id);
    } else if (filteredCategorias.length === 0) {
      setCategoriaId('');
    }
  }, [tipo, categorias, categoriaId]);

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setValorStr(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoriaId || !valorStr || !data) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    const valorNum = parseCurrency(valorStr);
    if (valorNum <= 0) {
      alert('O valor deve ser maior que zero.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: userId,
        tipo,
        categoria_id: categoriaId,
        valor: valorNum,
        data,
        observacao,
      };

      if (editingId) {
        const { error } = await supabase.from('lancamentos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lancamentos').insert([payload]);
        if (error) throw error;
      }

      setTipo('despesa');
      setValorStr('');
      setData(format(new Date(), 'yyyy-MM-dd'));
      setObservacao('');
      setEditingId(null);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar lançamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lancamento: Lancamento) => {
    setEditingId(lancamento.id);
    setTipo(lancamento.tipo);
    setCategoriaId(lancamento.categoria_id);
    setValorStr(formatCurrency(lancamento.valor));
    setData(lancamento.data);
    setObservacao(lancamento.observacao || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('lancamentos').delete().eq('id', deletingId);
      if (error) throw error;
      setDeleteModalOpen(false);
      setDeletingId(null);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir lançamento.');
    }
  };

  const sortedLancamentos = [...lancamentos].sort((a, b) => {
    const dateA = new Date(a.data).getTime();
    const dateB = new Date(b.data).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const visibleLancamentos = sortedLancamentos.slice(0, visibleCount);
  const hasMore = visibleCount < sortedLancamentos.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento)}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Categoria</label>
                <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  {filteredCategorias.length === 0 && (
                    <option value="" disabled>Nenhuma categoria</option>
                  )}
                  {filteredCategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Valor</label>
                <Input
                  type="text"
                  placeholder="R$ 0,00"
                  value={valorStr}
                  onChange={handleValorChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Data</label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Observação</label>
              <Input
                type="text"
                placeholder="Detalhes do lançamento..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-2"
                  onClick={() => {
                    setEditingId(null);
                    setValorStr('');
                    setObservacao('');
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={loading || filteredCategorias.length === 0}>
                {loading ? 'Salvando...' : editingId ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Observação</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  visibleLancamentos.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {format(parseLocalDate(l.data), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            l.tipo === 'receita'
                              ? 'bg-green-100 text-[#059568]'
                              : 'bg-red-100 text-[#EF4444]'
                          }`}
                        >
                          {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{l.categorias?.nome || 'N/A'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={l.observacao}>
                        {l.observacao || '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                          l.tipo === 'receita' ? 'text-[#059568]' : 'text-[#EF4444]'
                        }`}
                      >
                        {formatCurrency(l.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEdit(l)}
                            className="text-gray-400 hover:text-[#F59E0B] transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(l.id)}
                            className="text-gray-400 hover:text-[#EF4444] transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((prev) => prev + 20)}
              >
                Ver Mais Lançamentos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6 text-sm text-gray-600">
          Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita.
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
