import React, { useState, useEffect, useRef } from 'react';

interface DrugAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  medications: any[];
  placeholder?: string;
  required?: boolean;
}

const DrugAutocomplete: React.FC<DrugAutocompleteProps> = ({
  value,
  onChange,
  medications,
  placeholder = "Search or enter medication name...",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<any[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Filter medications based on input
    if (!value) {
      setFiltered([]);
      return;
    }
    
    const lowerValue = value.toLowerCase();
    const matches = medications.filter(med => 
      med.name.toLowerCase().includes(lowerValue)
    ).slice(0, 5); // Limit to 5 suggestions
    
    setFiltered(matches);
  }, [value, medications]);

  useEffect(() => {
    // Click outside handler to close dropdown
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
      <input
        type="text"
        className="input w-full"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        required={required}
      />
      
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.map((med, idx) => (
            <li
              key={idx}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
              onClick={() => {
                onChange(med.name);
                setIsOpen(false);
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{med.name}</div>
                  <div className="text-xs text-gray-500">Strength: {med.strength}</div>
                </div>
                {med.isEssentialMedicine && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                    WHO EML
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DrugAutocomplete;
