@AGENTS.md

# inanki — project guide for agents

## What this project is

A mobile-friendly PWA for scanning real-world content (words, expressions, handwritten conjugation tables) into Anki flashcard decks. The user is a native PT-BR speaker learning French from English.

## Stack

- **Next.js 16 (App Router)** — web + API routes
- **Tailwind CSS** — styling, mobile-first
- **Claude API (`@anthropic-ai/sdk`)** — card enrichment (`claude-haiku-4-5`) and vision (`claude-sonnet-4-6`)
- **sql.js + jszip** — `.apkg` file generation entirely in Node.js (no native deps)
- **localStorage** — all card/deck data stored client-side, no database

## Key files

| Path | Purpose |
|------|---------|
| `src/lib/types.ts` | Single `Card` type used everywhere |
| `src/lib/storage.ts` | localStorage read/write helpers (`getCards`, `saveCard`, `deleteCard`, `getDecks`, `saveDeck`, `deleteDeck`) |
| `src/lib/apkg.ts` | Builds `.apkg` from scratch (sql.js + jszip); also formats conjugation/word HTML |
| `src/app/api/enrich/route.ts` | POST — French word → `{front, back}` via Claude Haiku |
| `src/app/api/export/route.ts` | POST — cards array → `.apkg` binary |
| `src/app/api/import/route.ts` | POST — `.apkg` binary → parsed cards (preserves note IDs for Anki progress) |
| `src/app/api/detect-verb/route.ts` | POST — image → `{verb, tenses[]}` via Claude Sonnet vision |
| `src/app/api/scan-conjugation/route.ts` | POST — verb + tenses → conjugations scraped from gymglish |
| `src/components/WordCardForm.tsx` | Word/expression input + enrichment preview |
| `src/components/PhotoCardForm.tsx` | Photo scan flow (conjugation mode working; generic mode stub) |
| `src/components/CardQueue.tsx` | Per-deck card list + export button |
| `src/components/DeckSelector.tsx` | Create, select, delete decks; import `.apkg` |
| `public/sql-wasm.wasm` | WASM binary for sql.js — must stay here for production |

## Card type

```typescript
interface Card {
  id: string;           // UUID (or note guid for imported cards)
  type: 'word' | 'photo';
  deckName: string;
  front: string;        // plain text
  back: string;         // plain text (word) or HTML (imported/photo)
  backHtml?: string;    // pre-rendered HTML; used directly on export (set for imported cards)
  imageDataUrl?: string;
  createdAt: number;    // ms timestamp — used as Anki note ID
  tags?: string[];      // e.g. ['aller', 'indicatif présent']
}
```

## Card back format

- **Word cards** — `back` is plain text: `"🇺🇸 <EN>\n🇧🇷 <PT-BR>\n\nExample: <sentence>"`; `formatBackAsHtml()` in `apkg.ts` renders it
- **Photo/conjugation cards** — `back` is one conjugation per line (`"je vais\ntu vas\n..."`); `formatConjugationAsHtml()` renders a two-column table
- **Imported cards** — `backHtml` is set to the raw HTML from the apkg; `back` may also be HTML; `apkg.ts` uses `backHtml` directly and skips formatting

## Anki `.apkg` notes

- Format: zip containing `collection.anki2` (SQLite) + `media` JSON + numbered media files
- Note IDs = `card.createdAt` (ms epoch). Batch photo cards use `Date.now() + i` to avoid collisions.
- Re-importing an `.apkg` with the same note IDs merges cleanly in Anki — no duplicates, progress preserved
- No AnkiWeb API; workflow: export `.apkg` → import into Anki desktop → Anki syncs with AnkiWeb
- Tags stored as space-separated string ` tag1 tag2 `; spaces within tags → underscores

## Photo scan flow

1. User picks/takes photo → client resizes to ≤1600px JPEG 85% via canvas
2. `/api/detect-verb` — Claude Sonnet vision extracts verb + tense list from image
3. `/api/scan-conjugation` — fetches gymglish, scrapes conjugations, normalises gender variants
4. User reviews tenses (checkboxes), clicks "Add N cards to deck"
5. Each tense → one card, tagged `[verb, tense]`

## Known gotchas

- `Promise.withResolvers` polyfill required for iOS < 17.4 (added inline in `layout.tsx`)
- Uncontrolled inputs (`ref`) used throughout — controlled inputs caused mobile reliability issues
- `sql-wasm.wasm` must be in `public/`, read via `readFileSync(join(process.cwd(), 'public/sql-wasm.wasm'))`
- **Mobile dev access**: `allowedDevOrigins` in `next.config.ts` must include the Mac's current LAN IP. Without this, the dev server silently breaks on mobile (buttons stop working). Update when IP changes.

## Environment variables

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Done

- [x] Word/expression card creation with Claude enrichment (EN + PT-BR translations + example)
- [x] Export deck as `.apkg` (sql.js + jszip, no native deps)
- [x] Mobile-friendly UI; fixed iOS hydration bug (Promise.withResolvers polyfill)
- [x] Photo scan — conjugation mode: camera → Claude vision → gymglish ground truth → multiple cards
- [x] Conjugation table formatting (two-column, pronoun/form, handles elision like j'/qu')
- [x] Gender variant normalisation in gymglish scraper (il/elle, allé(e), allés(es))
- [x] Progress log UI during photo scan (terminal-style dark panel)
- [x] Verb + tense tags on conjugation cards
- [x] Import `.apkg` — parses SQLite, restores cards with original note IDs (Anki progress preserved)
- [x] Delete deck (with inline confirmation)
- [x] Edit existing cards inline (pencil icon; read-only back preview for imported cards)
- [x] Imported card badge in card queue
- [x] iOS input zoom fix (`font-size: max(16px, 1em)` in globals.css)
- [x] Anki card dark mode CSS (`prefers-color-scheme: dark`)
- [x] Generic photo scan mode — Claude vision extracts idioms/rare vocab from any French text photo, tuned for B2 PT-BR learner (strict prompt, empty result is valid)
- [x] User-provided Anthropic API key — visit `/?k=sk-ant-...` to set; stored in localStorage, stripped from URL; key prompt shown on first visit; all API routes accept `x-anthropic-key` header with fallback to env var

## To do

- [ ] Deploy to Vercel
- [ ] Bulk delete cards from a deck
- [ ] Dark mode for the inanki web UI
- [ ] PWA manifest / install-to-homescreen support
