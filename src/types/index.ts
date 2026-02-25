export type TipoLancamento = 'receita' | 'despesa';

export interface Categoria {
  id: string;
  user_id: string;
  nome: string;
  tipo: TipoLancamento;
  created_at: string;
}

export interface Lancamento {
  id: string;
  user_id: string;
  tipo: TipoLancamento;
  categoria_id: string;
  valor: number;
  data: string;
  observacao: string;
  created_at: string;
  categorias?: Categoria; // Joined data
}

export interface User {
  id: string;
  email: string;
}
