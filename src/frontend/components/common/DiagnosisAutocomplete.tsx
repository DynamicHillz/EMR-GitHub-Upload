import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader } from 'lucide-react';

export interface Diagnosis {
  id: string;
  // null for a shared/global reference row (e.g. bulk-imported ICD-10) —
  // see DiagnosisCatalog.tenantId in prisma/schema.prisma.
  tenantId: string | null;
  code: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
}

export type DiagnosisCodeSystem = 'ICD-11' | 'ICD-10';

interface DiagnosisAutocompleteProps {
  onSelect: (diagnosis: Diagnosis) => void;
  placeholder?: string;
  /** Shows an ICD-11/ICD-10 toggle above the search box. Defaults to true —
   * pass false for a caller that wants a fixed single system with no toggle. */
  allowCodeSystemToggle?: boolean;
}

const DiagnosisAutocomplete: React.FC<DiagnosisAutocompleteProps> = ({
  onSelect,
  placeholder,
  allowCodeSystemToggle = true,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [codeSystem, setCodeSystem] = useState<DiagnosisCodeSystem>('ICD-11');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const effectivePlaceholder =
    placeholder || `Search ${codeSystem} diagnosis by name or code...`;

  useEffect(() => {
    const fetchDiagnoses = async () => {
      if (query !== '' && query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const response = await fetch(`${apiBaseUrl}/api/clinical/diagnoses?query=${encodeURIComponent(query)}&codeSystem=${codeSystem}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const result = await response.json();
          setResults(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching diagnoses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchDiagnoses, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, codeSystem]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {allowCodeSystemToggle && (
        <div className="flex gap-1 mb-1">
          {(['ICD-11', 'ICD-10'] as DiagnosisCodeSystem[]).map((system) => (
            <button
              key={system}
              type="button"
              onClick={() => {
                setCodeSystem(system);
                setResults([]);
              }}
              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                codeSystem === system
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {system}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          className="input w-full pl-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={effectivePlaceholder}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>
      
      {isOpen && (query.trim().length >= 2 || query === '') && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.length > 0 ? (
            results.map((diagnosis) => (
              <li
                key={diagnosis.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 border-b last:border-b-0"
                onClick={() => {
                  onSelect(diagnosis);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-blue-700">{diagnosis.code}</div>
                    <div className="font-medium">{diagnosis.name}</div>
                  </div>
                  {diagnosis.type && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                      WHO {diagnosis.type}
                    </span>
                  )}
                </div>
              </li>
            ))
          ) : (
            !isLoading && (
              <li className="px-4 py-3 text-sm text-gray-500 text-center">
                No diagnoses found matching "{query}"
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
};

export default DiagnosisAutocomplete;
