import React from 'react';
import { Modal } from '@/components/ui/modal';
import { User } from '@/types';
import { User as UserIcon, Mail, Phone, Calendar, Star, Shield, AlertCircle, Hash, UserCheck, Car, Database, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onToggleStatus: (userId: string, currentStatus: string) => void;
  onTogglePremium: (userId: string, currentPremiumUntil: string | null, duration?: 'week' | 'month' | 'year') => void;
  onDeleteUser: (userId: string) => void;
  onApprovePayment?: (userId: string, plan: string) => void;
  onRejectPayment?: (userId: string) => void;
}

export function UserDetailsModal({ isOpen, onClose, user, onToggleStatus, onTogglePremium, onDeleteUser, onApprovePayment, onRejectPayment }: UserDetailsModalProps) {
  console.log('User details modal user:', user);
  if (!user) return null;

  const isPremium = user.premium_until && new Date(user.premium_until) > new Date();
  const isBlocked = user.status === 'blocked';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Usuário" className="max-w-lg">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
            {user.foto_url ? (
              <img src={user.foto_url} alt={user.nome} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-10 w-10 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{user.nome || 'Sem nome'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailItem icon={Phone} label="Telefone" value={user.telefone || 'Não informado'} />
          <DetailItem icon={Calendar} label="Criado em" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} />
          <DetailItem icon={Shield} label="Role" value={user.role || 'user'} />
          <DetailItem icon={UserCheck} label="Status" value={user.status === 'blocked' ? 'Bloqueado' : 'Ativo'} />
          <DetailItem icon={Star} label="Premium" value={isPremium ? `Até ${new Date(user.premium_until!).toLocaleDateString()}` : 'Grátis'} />
          <DetailItem icon={Star} label="Status Premium" value={user.premium_status === 'pending' ? 'Pendente' : (user.premium_status === 'active' ? 'Ativo' : 'Nenhum')} />
          {user.was_premium_before_renewal && (
            <DetailItem icon={Star} label="Renovação" value="Sim (Já era Premium)" />
          )}
          <DetailItem icon={Car} label="Veículos" value={user.vehicle_count?.toString() || '0'} />
          <DetailItem icon={Database} label="Lançamentos" value={user.lancamentos_count?.toString() || '0'} />
          <DetailItem icon={DollarSign} label="Movimentado" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.total_movimentado || 0)} />
        </div>

        {user.premium_status === 'pending' && user.payment_receipt_url && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pagamento Pendente ({user.premium_plan === 'yearly' ? 'Anual' : 'Mensal'})
            </h4>
            <a href={user.payment_receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mb-4 block">
              Ver Comprovante de Pagamento
            </a>
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                onClick={() => onApprovePayment && onApprovePayment(user.id, user.premium_plan || 'monthly')}
              >
                Aprovar
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={() => onRejectPayment && onRejectPayment(user.id)}
              >
                Rejeitar
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" onClick={() => onToggleStatus(user.id, user.status || 'active')}>
            {isBlocked ? 'Desbloquear' : 'Bloquear'}
          </Button>
          {isPremium ? (
            <Button variant="outline" onClick={() => onTogglePremium(user.id, user.premium_until)}>Remover Premium</Button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => onTogglePremium(user.id, user.premium_until, 'week')}>+1 Sem</Button>
              <Button variant="outline" onClick={() => onTogglePremium(user.id, user.premium_until, 'month')}>+1 Mês</Button>
              <Button variant="outline" onClick={() => onTogglePremium(user.id, user.premium_until, 'year')}>+1 Ano</Button>
            </div>
          )}
          <Button variant="destructive" onClick={() => onDeleteUser(user.id)}>Excluir Usuário</Button>
        </div>
      </div>
    </Modal>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
    </div>
  );
}
