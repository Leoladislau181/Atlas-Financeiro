import React, { useState, useEffect, useRef } from 'react';
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
    <div className={cn("space-y-2", className)}>
      <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase ml-1 block">{label}</label>
      
      <div className="flex items-center justify-center gap-4 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 shadow-sm">
        {/* Hours */}
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={() => adjustHour(1)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-indigo-600">
            <ChevronUp className="h-5 w-5" />
          </button>
          <span className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums min-w-[40px] text-center">
            {h.toString().padStart(2, '0')}
          </span>
          <button type="button" onClick={() => adjustHour(-1)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-indigo-600">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        <span className="text-xl font-bold text-gray-300 dark:text-gray-700">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={() => adjustMinute(5)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-indigo-600">
            <ChevronUp className="h-5 w-5" />
          </button>
          <span className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums min-w-[40px] text-center">
            {m.toString().padStart(2, '0')}
          </span>
          <button type="button" onClick={() => adjustMinute(-5)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-indigo-600">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
