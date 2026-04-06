@AGENTS.md

# inanki — project guide for agents

## What this project is

A mobile-friendly PWA for scanning real-world content (words, expressions, handwritten conjugation tables) into Anki flashcard decks. The user is a native PT-BR speaker learning French from English.

## Stack

- **Next.js 16 (App Router)** — web + API routes
- **Tailwind CSS** — styling, mobile-first
- **Claude API (`@anthropic-ai/sdk`)** — card enrichment and (future) OCR
- **sql.js + jszip** — `.apkg` file generation entirely in Node.js (no native deps)
- **localStorage** — all card/deck data stored client-side, no database

## Key files

| Path | Purpose |
|------|---------|
| `src/lib/types.ts` | Single `Card` type used everywhere |
| `src/lib/storage.ts` | localStorage read/write helpers |
| `src/lib/apkg.ts` | Builds `.apkg` files from scratch using sql.js + jszip |
| `src/app/api/enrich/route.ts` | POST — given a French word, returns `{front, back}` via Claude Haiku |
| `src/app/api/export/route.ts` | POST — given cards array, returns `.apkg` binary |
| `src/components/WordCardForm.tsx` | Word/expression input + enrichment preview |
| `src/components/PhotoCardMock.tsx` | Placeholder for photo scan (not yet implemented) |
| `src/components/CardQueue.tsx` | Per-deck card list + export button |
| `src/components/DeckSelector.tsx` | Create and switch between named decks |
| `public/sql-wasm.wasm` | WASM binary for sql.js — must stay here for production |

## Card format

- **Front:** French word or expression
- **Back (HTML):** `🇺🇸 EN translation` / `🇧🇷 PT-BR translation` + example sentence in French with English translation
- Cards are stored with a stable UUID (`card.id`) mapped to a valid Anki note ID via `uuidToAnkiId()` — allows re-importing updated `.apkg` files without duplicates

## Anki `.apkg` notes

- Format: zip containing `collection.anki2` (SQLite) + `media` JSON
- Note/card IDs must be in millisecond-epoch range (2000–2099) or Anki warns about future timestamps
- Re-importing an `.apkg` with the same note IDs merges cleanly — no duplicates
- No AnkiWeb API exists; workflow is: export `.apkg` → import into Anki desktop → Anki syncs with AnkiWeb

## Environment variables

```
ANTHROPIC_API_KEY=sk-ant-...
```

## What's next

- Photo card flow: camera capture → Claude vision OCR → extract conjugation table → generate multiple cards per photo
