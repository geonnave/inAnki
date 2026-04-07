'use client';

import { useEffect, useState } from 'react';
import DeckSelector from '@/components/DeckSelector';
import WordCardForm from '@/components/WordCardForm';
import PhotoCardForm from '@/components/PhotoCardForm';
import CardQueue from '@/components/CardQueue';
import { Card } from '@/lib/types';
import { getDecks, getCardsForDeck, saveCard, deleteCard } from '@/lib/storage';

type Tab = 'word' | 'photo';

export default function Home() {
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [tab, setTab] = useState<Tab>('word');
  const [exporting, setExporting] = useState(false);

  function reload() {
    const d = getDecks();
    setDecks(d);
    if (selectedDeck) setCards(getCardsForDeck(selectedDeck));
  }

  function handleSelect(deck: string) {
    setSelectedDeck(deck);
    setDecks(getDecks());
  }

  useEffect(() => {
    const d = getDecks();
    setDecks(d);
    if (d.length > 0) setSelectedDeck(d[0]);
  }, []);

  useEffect(() => {
    if (selectedDeck) setCards(getCardsForDeck(selectedDeck));
    else setCards([]);
  }, [selectedDeck]);

  function handleAdd(card: Card | Card[]) {
    const toAdd = Array.isArray(card) ? card : [card];
    toAdd.forEach(saveCard);
    setCards(getCardsForDeck(toAdd[0].deckName));
  }

  function handleDelete(id: string) {
    deleteCard(id);
    if (selectedDeck) setCards(getCardsForDeck(selectedDeck));
  }

  function handleSave(card: Card) {
    saveCard(card);
    if (selectedDeck) setCards(getCardsForDeck(selectedDeck));
  }

  async function handleExport() {
    if (!selectedDeck || cards.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckName: selectedDeck, cards }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDeck}.apkg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed. Please try again.');
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">inanki</h1>
          <p className="text-sm text-gray-400 mt-0.5">Scan life into Anki</p>
        </div>

        {/* Deck selector */}
        <DeckSelector
          decks={decks}
          selected={selectedDeck}
          onSelect={handleSelect}
          onDecksChange={reload}
        />

        {selectedDeck ? (
          <>
            {/* Tab switcher */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
              {(['word', 'photo'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'word' ? 'Word / Expression' : 'Photo Scan'}
                </button>
              ))}
            </div>

            {/* Input form */}
            {tab === 'word' ? (
              <WordCardForm deckName={selectedDeck} onAdd={handleAdd} />
            ) : (
              <PhotoCardForm deckName={selectedDeck} onAdd={handleAdd} />
            )}

            {/* Card queue */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Deck · {cards.length} card{cards.length !== 1 ? 's' : ''}
              </h2>
              <CardQueue
                cards={cards}
                onDelete={handleDelete}
                onSave={handleSave}
                onExport={handleExport}
                exporting={exporting}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            Create or select a deck to get started.
          </p>
        )}
      </div>
    </main>
  );
}
