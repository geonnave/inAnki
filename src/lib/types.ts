export interface Card {
  id: string;
  type: 'word' | 'photo';
  deckName: string;
  front: string;
  back: string;
  imageDataUrl?: string;
  createdAt: number;
  tags?: string[];
}
