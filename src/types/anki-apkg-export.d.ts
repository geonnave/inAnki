declare module 'anki-apkg-export' {
  interface CardOptions {
    tags?: string[];
  }

  class AnkiExport {
    constructor(deckName: string);
    addCard(front: string, back: string, options?: CardOptions): void;
    addMedia(filename: string, data: Buffer): void;
    save(): Promise<Uint8Array>;
  }

  export default AnkiExport;
  export { AnkiExport as Exporter };
}
