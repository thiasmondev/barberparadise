"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X } from "lucide-react";

// Suggestion simple (string) ou enrichie (slug + label affiché)
export type AutocompleteSuggestion = string | { slug: string; label: string; parent?: string };

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteSuggestion[];
  placeholder?: string;
  label?: string;
  className?: string;
  allowCustom?: boolean;
}

function getSlug(s: AutocompleteSuggestion): string {
  return typeof s === "string" ? s : s.slug;
}

function getLabel(s: AutocompleteSuggestion): string {
  return typeof s === "string" ? s : s.label;
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder = "",
  className = "",
  allowCustom = true,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronise l'input quand la valeur externe change (ex: ouverture modale)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Ferme la liste si clic en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filtrer sur le slug ET le label
  const filtered = suggestions.filter((s) => {
    const slug = getSlug(s).toLowerCase();
    const label = getLabel(s).toLowerCase();
    const q = query.toLowerCase();
    return slug.includes(q) || label.includes(q);
  });

  const handleInput = useCallback(
    (val: string) => {
      setQuery(val);
      setOpen(true);
      if (allowCustom) onChange(val);
    },
    [allowCustom, onChange]
  );

  const handleSelect = useCallback(
    (s: AutocompleteSuggestion) => {
      const slug = getSlug(s);
      setQuery(slug);
      onChange(slug);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 pr-16 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
            tabIndex={-1}
          >
            <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              {query ? `"${query}" — valeur personnalisée` : "Aucune suggestion"}
            </div>
          ) : (
            filtered.map((s) => {
              const slug = getSlug(s);
              const label = getLabel(s);
              const isLevel3 = label.startsWith("↳");
              return (
                <button
                  key={slug}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary transition-colors ${
                    slug === value ? "bg-primary/10 text-primary font-medium" : "text-gray-700"
                  } ${isLevel3 ? "pl-6" : ""}`}
                >
                  <div className="flex flex-col">
                    {/* Label hiérarchique avec surlignage */}
                    <span className={`${isLevel3 ? "text-xs text-gray-500" : "text-sm"}`}>
                      {query ? <HighlightMatch text={label} query={query} /> : label}
                    </span>
                    {/* Slug en dessous si différent du label */}
                    {label !== slug && (
                      <span className="text-xs text-gray-400 font-mono">{slug}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}
