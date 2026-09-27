"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatCad, formatNumber, type MarketRow } from "@/lib/market";

const RESULT_LIMIT = 8;

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
}

/**
 * Command-palette search across every published price cell. Selecting a result
 * only moves the vehicle identity; odometer, ask and condition stay as entered.
 */
export function VehicleSearch({ rows, disabled, onSelect }: { rows: MarketRow[]; disabled?: boolean; onSelect: (row: MarketRow) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const tokens = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = tokens.length === 0 ? rows : rows.filter((row) => {
      const haystack = `${row.y} ${row.mk} ${row.md} ${row.p}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
    return [...matches].sort((a, b) => b.n - a.n).slice(0, RESULT_LIMIT);
  }, [rows, deferredQuery]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        if (disabled) return;
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);

  function choose(row: MarketRow | undefined) {
    if (!row) return;
    onSelect(row);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setQuery(""); setActive(0); } }}>
      <Dialog.Trigger className="search-trigger" disabled={disabled}>
        <SearchIcon /><span className="search-trigger-label">Search {rows.length ? formatNumber(rows.length) : ""} price cells</span><kbd>/</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="palette-backdrop" />
        <Dialog.Popup className="palette" initialFocus={inputRef}>
          <Dialog.Title className="sr-only">Search the Canadian market</Dialog.Title>
          <Dialog.Description className="sr-only">Type a year, make, model or province code. Choose a result to load that vehicle.</Dialog.Description>
          <div className="palette-input">
            <SearchIcon />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
              aria-label="Search year, make, model or province"
              placeholder="Try “2020 civic” or “F-150 AB”"
              value={query}
              spellCheck={false}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setActive((activeIndex + 1) % Math.max(1, results.length)); }
                if (event.key === "ArrowUp") { event.preventDefault(); setActive((activeIndex - 1 + results.length) % Math.max(1, results.length)); }
                if (event.key === "Enter") { event.preventDefault(); choose(results[activeIndex]); }
              }}
            />
            <kbd>esc</kbd>
          </div>
          <ul id={listId} role="listbox" aria-label="Matching price cells" className="palette-results">
            {results.length === 0 ? <li className="palette-empty">No published price cell matches “{deferredQuery}”.</li> : results.map((row, index) => (
              <li key={`${row.p}-${row.mk}-${row.md}-${row.y}`} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : undefined} onPointerMove={() => setActive(index)} onClick={() => choose(row)}>
                <span className="palette-badge">{row.p}</span>
                <span className="palette-name"><strong>{row.y} {row.mk} {row.md}</strong><small>{formatNumber(row.n)} listings · median {formatNumber(row.km)} km</small></span>
                <span className="palette-price">{formatCad(row.p50)}<small>market median</small></span>
              </li>
            ))}
          </ul>
          <footer className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> load vehicle</span><span className="palette-foot-note">Sorted by listings in the cell</span></footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
