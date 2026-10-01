import React from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPWAButton() {
  const { isInstallable, install } = usePWA();

  return (
    <AnimatePresence>
      {isInstallable && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded-2xl p-4 sm:p-6 shadow-lg shadow-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-400/20">
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="font-bold text-lg leading-tight">Atlas no seu Celular</h3>
                <p className="text-amber-50 text-sm mt-1">
                  Instale o App para acesso rápido e melhor performance.
                </p>
              </div>
            </div>
            <Button
              onClick={install}
              className="w-full sm:w-auto bg-white text-amber-700 hover:bg-amber-50 font-bold px-6 py-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Download className="h-5 w-5" />
              Baixar Aplicativo
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
