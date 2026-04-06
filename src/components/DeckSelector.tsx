'use client';

import { useState } from 'react';
import { saveDeck } from '@/lib/storage';

interface Props {
  decks: string[];
  selected: string;
  onSelect: (deck: string) => void;
  onDecksChange: () => void;
}

export default function DeckSelector({ decks, selected, onSelect, onDecksChange }: Props) {
  const [newDeck, setNewDeck] = useState('');

  function handleAdd() {
    const name = newDeck.trim();
    if (!name) return;
    saveDeck(name);
    onDecksChange();
    onSelect(name);
    setNewDeck('');
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Target deck</label>
      <div className="flex gap-2 flex-wrap">
        {decks.map((d) => (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              selected === d
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newDeck}
          onChange={(e) => setNewDeck(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New deck name..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAdd}
          disabled={!newDeck.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
