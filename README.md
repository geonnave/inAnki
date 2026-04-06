# inanki

Scan life into Anki. A mobile-friendly web app for turning real-world content into Anki flashcard decks.

- **Word cards** — type a French word or expression, get an AI-enriched card with English + PT-BR translations and an example sentence
- **Photo cards** _(coming soon)_ — photograph handwritten conjugation tables and generate multiple cards automatically

Exports `.apkg` files that import cleanly into Anki desktop, which then syncs with AnkiWeb.

## Requirements

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Works best on mobile via your local network (e.g. `http://192.168.x.x:3000`).

## Usage

1. **Create a deck** — type a name and press Add
2. **Add word cards** — type a French word and press Enrich; review the card, then Add to deck
3. **Export** — press Export to download a `.apkg` file
4. **Import into Anki** — File → Import in Anki desktop; re-importing an updated export merges by card ID (no duplicates)

## Build

```bash
npm run build
npm start
```
