import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DangerSignBannerProps {
  signs: string[];
  title?: string;
}

// Shared banner for the live, non-blocking danger-sign checks used across
// the ANC visit, partograph observation, and delivery outcome forms —
// previously each modal hand-rolled the same red-bordered markup.
// Informational only; never stops a form from being submitted.
const DangerSignBanner: React.FC<DangerSignBannerProps> = ({ signs, title = 'Danger Sign(s) Detected' }) => {
  if (signs.length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-900 text-sm">{title}</p>
          <ul className="text-red-800 text-sm mt-1 list-disc list-inside">
            {signs.map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DangerSignBanner;
