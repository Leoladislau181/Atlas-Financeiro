import React from 'react';
import { Modal } from '@/components/ui/modal';
import { User } from '@/types';
import { User as UserIcon, Mail, Phone, Calendar, Star, Shield, AlertCircle, Hash, UserCheck } from 'lucide-react';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export function UserDetailsModal({ isOpen, onClose, user }: UserDetailsModalProps) {
  if (!user) return null;

  const isPremium = user.premium_until && new Date(user.premium_until) > new Date();

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
          <DetailItem icon={Hash} label="ID" value={user.id} />
          <DetailItem icon={Phone} label="Telefone" value={user.telefone || 'Não informado'} />
          <DetailItem icon={Calendar} label="Criado em" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} />
          <DetailItem icon={Shield} label="Role" value={user.role || 'user'} />
          <DetailItem icon={UserCheck} label="Status" value={user.status === 'blocked' ? 'Bloqueado' : 'Ativo'} />
          <DetailItem icon={Star} label="Premium" value={isPremium ? `Até ${new Date(user.premium_until!).toLocaleDateString()}` : 'Grátis'} />
          <DetailItem icon={AlertCircle} label="Código Referência" value={user.referral_code || 'N/A'} />
          <DetailItem icon={AlertCircle} label="Referido por" value={user.referred_by || 'N/A'} />
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
