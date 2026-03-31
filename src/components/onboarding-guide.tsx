import React from 'react';
import { Car, Tags, PlusCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OnboardingGuideProps {
  step: 'vehicle' | 'category' | 'transaction';
  title: string;
  description: string;
  onClick?: () => void;
  buttonText: string;
}

export function OnboardingGuide({ step, title, description, onClick, buttonText }: OnboardingGuideProps) {
  const icons = {
    vehicle: <Car className="h-6 w-6 text-blue-500" />,
    category: <Tags className="h-6 w-6 text-purple-500" />,
    transaction: <PlusCircle className="h-6 w-6 text-green-500" />,
  };

  const bgColors = {
    vehicle: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    category: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    transaction: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  };

  return (
    <div className={`rounded-xl border p-4 mb-6 shadow-sm transition-all hover:shadow-md ${bgColors[step]}`}>
      <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
        <div className="flex-shrink-0 p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm">
          {icons[step]}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {title}
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
              Passo a Passo
            </span>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {description}
          </p>
        </div>

        <button
          onClick={onClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:focus:ring-white dark:focus:ring-offset-gray-900 w-full sm:w-auto mt-2 sm:mt-0"
        >
          {buttonText}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
