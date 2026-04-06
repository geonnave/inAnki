import { Card } from './types';

const CARDS_KEY = 'inanki_cards';
const DECKS_KEY = 'inanki_decks';

export function getCards(): Card[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CARDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveCard(card: Card): void {
  const cards = getCards();
  const existing = cards.findIndex((c) => c.id === card.id);
  if (existing >= 0) {
    cards[existing] = card;
  } else {
    cards.push(card);
  }
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

export function deleteCard(id: string): void {
  const cards = getCards().filter((c) => c.id !== id);
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

export function getCardsForDeck(deckName: string): Card[] {
  return getCards().filter((c) => c.deckName === deckName);
}

export function getDecks(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(DECKS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveDeck(name: string): void {
  const decks = getDecks();
  if (!decks.includes(name)) {
    decks.push(name);
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  }
}

export function deleteDeck(name: string): void {
  const decks = getDecks().filter((d) => d !== name);
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  // also remove all cards in this deck
  const cards = getCards().filter((c) => c.deckName !== name);
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}
