'use client';

import { useState } from 'react';
import { Card } from '@/lib/types';

interface Props {
  cards: Card[];
  onDelete: (id: string) => void;
  onSave: (card: Card) => void;
  onExport: () => void;
  exporting: boolean;
}

function backPreview(card: Card): string {
  return card.back.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split('\n')[0];
}

export default function CardQueue({ cards, onDelete, onSave, onExport, exporting }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftFront, setDraftFront] = useState('');
  const [draftBack, setDraftBack] = useState('');

  function startEdit(card: Card) {
    setEditingId(card.id);
    setDraftFront(card.front);
    setDraftBack(card.back);
  }

  function handleSave(card: Card) {
    const front = draftFront.trim();
    const back = draftBack.trim();
    if (!front) return;
    // If back was not changed and card has pre-rendered HTML, keep it.
    // If back changed, clear backHtml so it gets re-rendered on export.
    const backHtml = card.backHtml !== undefined && back === card.back ? card.backHtml : undefined;
    onSave({ ...card, front, back, backHtml });
    setEditingId(null);
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">No cards in this deck yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {cards.map((card) =>
          editingId === card.id ? (
            /* Edit form */
            <div key={card.id} className="border border-indigo-300 rounded-lg bg-white px-4 py-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Front</label>
                <input
                  value={draftFront}
                  onChange={(e) => setDraftFront(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Back</label>
                {card.backHtml ? (
                  <>
                    <textarea
                      value={card.back.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      readOnly
                      rows={card.type === 'photo' ? 6 : 3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 resize-none font-mono cursor-default"
                    />
                    <p className="text-xs text-gray-400 italic">Back is imported HTML — only front is editable.</p>
                  </>
                ) : (
                  <textarea
                    value={draftBack}
                    onChange={(e) => setDraftBack(e.target.value)}
                    rows={card.type === 'photo' ? 6 : 3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(card)}
                  disabled={!draftFront.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Normal row */
            <div key={card.id} className="border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3 bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{card.front}</p>
                  {card.backHtml && (
                    <span className="shrink-0 text-xs text-gray-400 border border-gray-200 rounded px-1 py-0.5 leading-none">
                      imported
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{backPreview(card)}</p>
              </div>
              <button
                onClick={() => startEdit(card)}
                className="text-gray-300 hover:text-indigo-400 transition-colors shrink-0 mt-0.5"
                aria-label="Edit card"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110.414 16H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(card.id)}
                className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                aria-label="Delete card"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        )}
      </div>

      <button
        onClick={onExport}
        disabled={exporting}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 transition-colors"
      >
        {exporting ? 'Generating...' : `Export ${cards.length} card${cards.length !== 1 ? 's' : ''} as .apkg`}
      </button>
    </div>
  );
}
