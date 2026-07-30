import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Drop-in replacement for a native <select> that always opens downward.
 *
 * Native <select> popups are rendered by the browser/OS and can flip
 * upward near the bottom of the viewport with no CSS/JS able to prevent
 * it — this renders its own options list instead, explicitly anchored
 * below the trigger, so it never flips.
 *
 * Accepts plain <option> children exactly like a native select (parsed
 * via React.Children), and calls onChange with an object shaped like
 * React.ChangeEvent<HTMLSelectElement> (only .target.name/.target.value
 * are ever read by existing handlers in this codebase) so every existing
 * call site works by only renaming the tag — no handler/type changes.
 */

interface DropdownOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  name?: string;
  id?: string;
  // Native <select>'s value also accepts numbers (e.g. <option value={m}>
  // for a month picker) — matching that here so callers don't need to
  // stringify values that worked fine as numbers before this migration.
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function parseOptions(children: React.ReactNode): DropdownOption[] {
  const options: DropdownOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    options.push({
      value: props.value !== undefined ? String(props.value) : '',
      label: props.children,
      disabled: props.disabled,
    });
  });
  return options;
}

// Only handles the common case (a plain string/number label, which is what
// every option in this codebase actually uses) — a non-text label (rare)
// just won't participate in type-ahead matching, same as before this existed.
function optionText(label: React.ReactNode): string {
  if (typeof label === 'string') return label;
  if (typeof label === 'number') return String(label);
  return '';
}

const Dropdown: React.FC<DropdownProps> = ({
  name,
  id,
  value,
  onChange,
  required,
  disabled,
  className,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Options list is portaled to document.body and positioned from the
  // trigger's own bounding rect — a plain absolutely-positioned list gets
  // silently clipped by any ancestor with overflow:hidden/auto (e.g. a
  // modal panel or a scrollable form body), which can hide options that
  // happen to fall below the clip line (see TypeaheadTextField.tsx for the
  // same fix applied to the clinical-terms suggestion dropdown).
  //
  // top/bottom are mutually exclusive: when there isn't enough room below
  // the trigger for even a shrunk list, the list opens upward (anchored via
  // `bottom` so it grows away from the viewport edge instead of off it) —
  // a trigger near the bottom of a tall modal would otherwise render a list
  // that's `position:fixed` past the bottom of the browser window, which no
  // amount of scrolling (inside the list or the page) can ever reveal.
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
  });

  const options = parseOptions(children);
  const normalizedValue = value !== undefined ? String(value) : '';
  const selectedIndex = options.findIndex((o) => o.value === normalizedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  // Type-ahead ("jump to the letter you type" instead of scrolling/arrowing
  // through, e.g. a 94-item HMO provider list) — native <select> does this
  // for free, but this is a fully custom-rendered list, so it doesn't come
  // for free here.
  //
  // Two native <select> behaviors, both reproduced here:
  // - Typing multiple different letters within the pause window accumulates
  //   into one search string ("cl" jumps straight to "Clearline...").
  // - Repeating the SAME letter within that window cycles forward through
  //   every option starting with that letter, rather than the buffer
  //   growing into "ccc" and failing to match anything.
  const TYPE_AHEAD_TIMEOUT_MS = 600;
  const searchRef = useRef({ query: '', lastKeyAt: 0 });

  const findTypeAheadMatch = (key: string, currentIndex: number): number => {
    const search = searchRef.current;
    const now = Date.now();
    const withinWindow = now - search.lastKeyAt < TYPE_AHEAD_TIMEOUT_MS;
    const isRepeatSameLetter = withinWindow && search.query.length > 0 && search.query.split('').every((c) => c === key);

    let query: string;
    let startAt: number;
    if (isRepeatSameLetter) {
      query = key; // still a single-letter search, just cycling forward
      startAt = currentIndex + 1;
    } else if (withinWindow) {
      query = search.query + key;
      startAt = 0;
    } else {
      query = key;
      startAt = 0;
    }

    search.query = isRepeatSameLetter ? search.query + key : query;
    search.lastKeyAt = now;

    const lower = query.toLowerCase();
    const n = options.length;
    for (let i = 0; i < n; i++) {
      const idx = (startAt + i) % n;
      const opt = options[idx];
      if (!opt.disabled && optionText(opt.label).toLowerCase().startsWith(lower)) {
        return idx;
      }
    }
    return -1;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = wrapperRef.current && wrapperRef.current.contains(target);
      const insideList = listRef.current && listRef.current.contains(target);
      if (!insideTrigger && !insideList) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The list's position is a snapshot taken when it opens, so it goes stale
  // the moment any ancestor scrolls or the viewport resizes. Closing on
  // either is simpler and safer than re-measuring on every scroll tick —
  // but scrolling *inside* the list itself (max-h-60 overflow-auto, needed
  // whenever there are more options than fit) must NOT count: that scroll
  // event still reaches this capture-phase listener even though the list
  // hasn't moved, and closing on it made it impossible to ever scroll down
  // to options past the fold (e.g. Duration's "STAT"/"Custom...").
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      if (listRef.current && listRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  const commitSelection = (option: DropdownOption) => {
    if (option.disabled) return;
    setIsOpen(false);
    if (!onChange) return;
    const syntheticEvent = {
      target: { name, value: option.value },
      currentTarget: { name, value: option.value },
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  const open = () => {
    if (disabled) return;
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const GAP = 4;
      const PREFERRED_HEIGHT = 240; // matches the list's old max-h-60
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
    }
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  // Space is excluded — it's already bound to open/select below, matching
  // native <select> (which also doesn't type-ahead on space). Modifier
  // combos (Ctrl+C etc.) are excluded too, so they still reach the browser
  // instead of being swallowed as a one-letter search.
  const isTypeAheadKey = (e: React.KeyboardEvent) =>
    e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
        return;
      }
      if (isTypeAheadKey(e)) {
        // Native <select> jumps the selected value immediately while
        // closed, without opening the list — matched here.
        e.preventDefault();
        const matchIndex = findTypeAheadMatch(e.key, selectedIndex >= 0 ? selectedIndex : -1);
        if (matchIndex >= 0) commitSelection(options[matchIndex]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const option = options[highlightedIndex];
      if (option) commitSelection(option);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    } else if (isTypeAheadKey(e)) {
      e.preventDefault();
      const matchIndex = findTypeAheadMatch(e.key, highlightedIndex);
      if (matchIndex >= 0) {
        setHighlightedIndex(matchIndex);
        listRef.current?.children[matchIndex]?.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={`${className || 'input w-full'} flex items-center justify-between text-left disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-required={required}
      >
        <span className="truncate">{selectedOption?.label ?? ''}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {isOpen && createPortal(
        <ul
          ref={listRef}
          role="listbox"
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
          {options.map((option, index) => (
            <li
              key={`${option.value}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => commitSelection(option)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                option.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : index === highlightedIndex
                  ? 'bg-primary-50 text-primary-900'
                  : 'text-gray-700 hover:bg-gray-50'
              } ${index === selectedIndex ? 'font-medium' : ''}`}
            >
              {option.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default Dropdown;
