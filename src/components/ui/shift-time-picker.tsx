import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftTimePickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export function ShiftTimePicker({ label, value, onChange, className }: ShiftTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value || '00:00');

  useEffect(() => {
    if (value) setInternalValue(value);
  }, [value]);

  const [h, m] = internalValue.split(':').map(Number);

  const updateTime = (newH: number, newM: number) => {
    const formatted = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    setInternalValue(formatted);
    onChange(formatted);
  };

  const adjustHour = (delta: number) => {
    let nextH = (h + delta + 24) % 24;
    updateTime(nextH, m);
  };

  const adjustMinute = (delta: number) => {
    let nextM = (m + delta + 60) % 60;
    updateTime(h, nextM);
  };

  return (
    <div className={cn("relative", className)}>
      <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase ml-1 block mb-1">{label}</label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-12 px-4 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:border-indigo-400 transition-all shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {internalValue}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute z-50 mt-2 p-5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-[220px] left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0"
            >
              <div className="flex items-center justify-around mb-4">
                {/* Hours */}
                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => adjustHour(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-indigo-600">
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <span className="text-3xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
                    {h.toString().padStart(2, '0')}
                  </span>
                  <button type="button" onClick={() => adjustHour(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-indigo-600">
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>

                <span className="text-2xl font-bold text-gray-300 mb-1">:</span>

                {/* Minutes */}
                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => adjustMinute(5)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-indigo-600">
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <span className="text-3xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
                    {m.toString().padStart(2, '0')}
                  </span>
                  <button type="button" onClick={() => adjustMinute(-5)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-indigo-600">
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none transition-all"
                >
                  <Check className="h-4 w-4" /> Pronto
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
