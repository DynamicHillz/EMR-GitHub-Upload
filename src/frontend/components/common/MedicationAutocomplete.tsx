import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader, Pill } from 'lucide-react';

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  strength?: string;
  dosageForm?: string;
  isEssentialMedicine?: boolean;
  isControlledSubstance?: boolean;
  scheduleClass?: string;
}

interface MedicationAutocompleteProps {
  onSelect: (medication: Medication) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const MedicationAutocomplete: React.FC<MedicationAutocompleteProps> = ({
  onSelect,
  placeholder = "Search medication by name...",
  value = '',
  onChange,
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [filteredResults, setFilteredResults] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMedications = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const response = await fetch(`${apiBaseUrl}/api/pharmacy/medications`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const result = await response.json();
          setMedications(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching medications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedications();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFilteredResults(medications);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = medications.filter(med => 
      med.name.toLowerCase().includes(lowerQuery) || 
      (med.genericName && med.genericName.toLowerCase().includes(lowerQuery)) ||
      (med.brandName && med.brandName.toLowerCase().includes(lowerQuery))
    );
    setFilteredResults(filtered);
  }, [query, medications]);

  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  }, [value]);

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
      <div className="relative">
        <input
          type="text"
          className="input w-full pl-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onChange) onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>
      
      {isOpen && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredResults.length > 0 ? (
            filteredResults.map((med) => (
              <li
                key={med.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 border-b last:border-b-0"
                onClick={() => {
                  onSelect(med);
                  setQuery(med.name);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-blue-700">{med.name}</div>
                    {med.genericName && <div className="text-xs text-gray-500">Generic: {med.genericName}</div>}
                  </div>
                  <div className="flex flex-col items-end">
                    {med.strength && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">
                        {med.strength} {med.dosageForm}
                      </span>
                    )}
                    {med.isEssentialMedicine && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 mt-1">
                        Essential
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))
          ) : (
            !isLoading && (
              <li className="px-4 py-3 text-sm text-gray-500 text-center">
                No medications found matching "{query}"
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
};

export default MedicationAutocomplete;
