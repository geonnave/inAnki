'use client';

import { Card } from '@/lib/types';

interface Props {
  cards: Card[];
  onDelete: (id: string) => void;
  onExport: () => void;
  exporting: boolean;
}

export default function CardQueue({ cards, onDelete, onExport, exporting }: Props) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">No cards in this deck yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {cards.map((card) => (
          <div key={card.id} className="border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3 bg-white">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{card.front}</p>
              <p className="text-sm text-gray-500 truncate">
                {card.back.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split('\n')[0]}
              </p>
            </div>
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
        ))}
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
