import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClinicalSuggestions } from '../../hooks/useClinicalSuggestions';

type FieldElement = HTMLTextAreaElement | HTMLInputElement;
type FieldChangeEvent = React.ChangeEvent<FieldElement>;

interface TypeaheadTextFieldProps {
  name?: string;
  id?: string;
  value: string;
  onChange: (e: FieldChangeEvent) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
  placeholder?: string;
}

const WORD_CHAR = /[A-Za-z'-]/;

function findWordStart(value: string, cursor: number): number {
  let start = cursor;
  while (start > 0 && WORD_CHAR.test(value[start - 1])) start--;
  return start;
}

/**
 * Drop-in replacement for a plain <textarea>/<input type="text"> (renders a
 * textarea when `rows` is passed, otherwise an input — same props a caller
 * already passes, so existing state/onChange handlers work unchanged) that
 * suggests clinical terms as the word under the cursor is typed. Never
 * rewrites text on its own — every suggestion requires the clinician to
 * click, Tab, or Enter to accept it, since silently autocorrecting clinical
 * documentation is a real safety risk (see useClinicalSuggestions.ts).
 */
const TypeaheadTextField: React.FC<TypeaheadTextFieldProps> = ({
  name,
  id,
  value,
  onChange,
  required,
  disabled,
  className,
  rows,
  placeholder,
}) => {
  const { getSuggestions } = useClinicalSuggestions();
  const elementRef = useRef<FieldElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [wordRange, setWordRange] = useState<{ start: number; end: number } | null>(null);
  // Dropdown is portaled to document.body and positioned from the field's
  // own bounding rect — a plain absolutely-positioned dropdown gets clipped
  // whenever a caller nests this field inside any ancestor with
  // overflow:hidden/auto (e.g. WardRoundModal's rounded-corner modal panel,
  // DischargeModal's scrollable form body), silently hiding every suggestion.
  // top/bottom are mutually exclusive: when there isn't room below the field
  // for even a shrunk list, it opens upward (anchored via `bottom`) instead
  // of rendering `position:fixed` past the bottom of the browser window,
  // where no amount of scrolling could ever reveal it.
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
  });

  const checkForSuggestions = (element: FieldElement) => {
    const cursor = element.selectionStart ?? 0;
    const charAtCursor = element.value[cursor];

    // Only offer suggestions while actively at the tail of a word — not
    // mid-word (cursor placed inside an already-complete word) and not
    // right after a space/punctuation.
    if (charAtCursor && WORD_CHAR.test(charAtCursor)) {
      setIsOpen(false);
      return;
    }

    const start = findWordStart(element.value, cursor);
    const currentWord = element.value.slice(start, cursor);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (currentWord.length < 3) {
      setIsOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const results = await getSuggestions(currentWord);
      if (requestId !== requestIdRef.current) return; // a newer keystroke superseded this lookup
      if (results.length === 0) {
        setIsOpen(false);
        return;
      }
      const rect = element.getBoundingClientRect();
      const GAP = 4;
      const PREFERRED_HEIGHT = 240; // matches the dropdown's old max-h-60
      const spaceBelow = window.innerHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;
      const openUpward = spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow;
      const maxHeight = Math.max(100, Math.min(PREFERRED_HEIGHT, openUpward ? spaceAbove : spaceBelow));
      setPosition({
        left: rect.left,
        width: rect.width,
        maxHeight,
        top: openUpward ? undefined : rect.bottom + GAP,
        bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      });
      setSuggestions(results);
      setWordRange({ start, end: cursor });
      setHighlightedIndex(0);
      setIsOpen(true);
    }, 150);
  };

  const acceptSuggestion = (suggestion: string) => {
    const element = elementRef.current;
    if (!element || !wordRange) return;

    const newValue = value.slice(0, wordRange.start) + suggestion + ' ' + value.slice(wordRange.end);
    const newCursor = wordRange.start + suggestion.length + 1;

    setIsOpen(false);

    // Shaped like a real ChangeEvent but only carries what every existing
    // handler in this codebase actually reads (.target.name/.target.value) —
    // same technique Dropdown.tsx uses for its synthetic select event.
    const syntheticEvent = {
      target: { name, value: newValue },
      currentTarget: { name, value: newValue },
    } as unknown as FieldChangeEvent;
    onChange(syntheticEvent);

    // Restore cursor position after the value updates on the next tick.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<FieldElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      acceptSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideField = wrapperRef.current && wrapperRef.current.contains(target);
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!insideField && !insideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The dropdown is positioned from a snapshot of the field's bounding rect,
  // so it goes stale the moment any ancestor (the field's own container, a
  // modal body, the page) scrolls or the viewport resizes. Closing on either
  // is simpler and safer than re-measuring on every scroll tick — but
  // scrolling *inside* the dropdown itself (max-h-60 overflow-auto) must not
  // count, or it becomes impossible to scroll down to later suggestions.
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sharedProps = {
    name,
    id,
    value,
    required,
    disabled,
    className,
    placeholder,
    onChange: (e: FieldChangeEvent) => {
      onChange(e);
      checkForSuggestions(e.target);
    },
    onKeyDown: handleKeyDown,
    onClick: (e: React.MouseEvent<FieldElement>) => checkForSuggestions(e.currentTarget),
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {rows ? (
        <textarea {...sharedProps} rows={rows} ref={elementRef as React.Ref<HTMLTextAreaElement>} />
      ) : (
        <input {...sharedProps} type="text" ref={elementRef as React.Ref<HTMLInputElement>} />
      )}

      {isOpen && suggestions.length > 0 && createPortal(
        <ul
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: position.top,
            bottom: position.bottom,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
          className="z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              onMouseDown={(e) => {
                // mousedown (not click) fires before the field's blur, so
                // the suggestion is still accepted even though clicking a
                // list item would otherwise blur the field first.
                e.preventDefault();
                acceptSuggestion(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                index === highlightedIndex ? 'bg-primary-50 text-primary-900' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default TypeaheadTextField;
