'use client';

import { useRef, useState } from 'react';
import { saveDeck, saveCard, deleteDeck } from '@/lib/storage';
import { Card } from '@/lib/types';

interface Props {
  decks: string[];
  selected: string;
  onSelect: (deck: string) => void;
  onDecksChange: () => void;
}

export default function DeckSelector({ decks, selected, onSelect, onDecksChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  function handleAdd() {
    const name = inputRef.current?.value.trim() ?? '';
    if (!name) return;
    saveDeck(name);
    onDecksChange();
    onSelect(name);
    if (inputRef.current) inputRef.current.value = '';
    setHasContent(false);
  }

  function handleDelete(name: string) {
    deleteDeck(name);
    onDecksChange();
    if (selected === name) onSelect('');
    setConfirmDelete(null);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const cards: Card[] = data.cards;
      const deckNames: string[] = data.deckNames;
      deckNames.forEach(saveDeck);
      cards.forEach(saveCard);
      onDecksChange();
      if (deckNames.length > 0) onSelect(deckNames[0]);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Target deck</label>

      {/* Deck pills */}
      <div className="flex gap-2 flex-wrap">
        {decks.map((d) => (
          <div key={d} className="relative flex items-center">
            {confirmDelete === d ? (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-red-300 bg-red-50 text-xs">
                <span className="text-red-600 font-medium">Delete &ldquo;{d}&rdquo;?</span>
                <button
                  onClick={() => handleDelete(d)}
                  className="text-red-600 font-semibold hover:text-red-800 px-1"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-gray-500 hover:text-gray-700 px-1"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelect(d)}
                className={`pl-3 pr-1 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1 ${
                  selected === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {d}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}
                  className={`ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-xs transition-colors ${
                    selected === d ? 'hover:bg-indigo-500' : 'hover:bg-gray-200'
                  }`}
                  aria-label={`Delete deck ${d}`}
                >
                  ×
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* New deck input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          onChange={(e) => setHasContent(e.target.value.trim().length > 0)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New deck name..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAdd}
          disabled={!hasContent}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Import */}
      <input
        ref={importRef}
        type="file"
        accept=".apkg"
        onChange={handleImportFile}
        className="hidden"
      />
      <button
        onClick={() => importRef.current?.click()}
        disabled={importing}
        className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 transition-colors"
      >
        {importing ? 'Importing...' : 'Import .apkg'}
      </button>
      {importError && <p className="text-red-500 text-xs">{importError}</p>}
    </div>
  );
}
