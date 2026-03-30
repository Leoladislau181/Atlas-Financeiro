import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Star, Zap } from 'lucide-react';
import { User } from '@/types';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  user?: User | null;
}

export function PremiumModal({ isOpen, onClose, featureName, user }: PremiumModalProps) {
  const isPending = user?.premium_status === 'pending';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Funcionalidade Premium">
      <div className="text-center space-y-4">
        <div className={`inline-flex items-center justify-center p-3 rounded-full mb-2 ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
          {isPending ? (
            <Zap className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          ) : (
            <Star className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {featureName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isPending 
            ? 'Esta funcionalidade será liberada assim que seu pagamento for confirmado pela nossa equipe. Obrigado por aguardar!'
            : 'Esta é uma funcionalidade exclusiva do plano Premium. Faça o upgrade para desbloquear este e muitos outros recursos!'}
        </p>
        <div className="pt-4 flex flex-col gap-2">
          <Button onClick={onClose} className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white">
            Entendi
          </Button>
        </div>
      </div>
    </Modal>
  );
}
