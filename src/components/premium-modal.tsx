import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

export function PremiumModal({ isOpen, onClose, featureName }: PremiumModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Funcionalidade Premium">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-2">
          <Star className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {featureName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Esta é uma funcionalidade exclusiva do plano Premium. Faça o upgrade para desbloquear este e muitos outros recursos!
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
