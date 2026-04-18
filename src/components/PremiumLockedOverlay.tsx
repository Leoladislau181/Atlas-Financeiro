import React from 'react';
import { Lock } from 'lucide-react';
import { isPremium } from '@/lib/utils';
import { User } from '@/types';

interface PremiumLockedOverlayProps {
  user: User;
  children: React.ReactNode;
  onUnlock: () => void;
  className?: string;
}

export function PremiumLockedOverlay({ user, children, onUnlock, className = '' }: PremiumLockedOverlayProps) {
  if (isPremium(user)) {
    return <>{children}</>;
  }

  return (
    <div className={`relative group ${className}`}>
      {/* Blurred Content */}
      <div className="filter blur-[4px] pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-[2px] rounded-xl cursor-pointer transition-all hover:bg-white/30 dark:hover:bg-black/30 z-10"
        onClick={onUnlock}
      >
        <div className="bg-white dark:bg-gray-900 p-4 rounded-full shadow-lg border border-amber-200 dark:border-amber-800 animate-bounce">
          <Lock className="h-6 w-6 text-amber-500" />
        </div>
        <div className="mt-4 text-center px-4">
          <p className="text-sm font-bold text-gray-900 dark:text-white bg-white/90 dark:bg-gray-900/90 px-3 py-1 rounded-full shadow-sm">
            Recurso Premium
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Toque para desbloquear
          </p>
        </div>
      </div>
    </div>
  );
}
