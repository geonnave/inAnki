import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { Card } from '@/lib/types';

const FIELD_SEP = '\x1f';

export async function POST(req: NextRequest) {
  const arrayBuffer = await req.arrayBuffer();

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    return NextResponse.json({ error: 'Invalid .apkg file' }, { status: 400 });
  }

  const mediaFile = zip.file('media');
  const dbFile = zip.file('collection.anki2');
  if (!dbFile) return NextResponse.json({ error: 'No collection.anki2 found' }, { status: 400 });

  // Parse media map: { "0": "0.jpg", ... }
  const mediaJson: Record<string, string> = mediaFile
    ? JSON.parse(await mediaFile.async('string'))
    : {};

  // Reverse: filename → zip key
  const filenameToKey: Record<string, string> = {};
  for (const [key, filename] of Object.entries(mediaJson)) {
    filenameToKey[filename] = key;
  }

  // Load media files as base64 data URLs
  const mediaDataUrls: Record<string, string> = {};
  for (const key of Object.keys(mediaJson)) {
    const file = zip.file(key);
    if (file) {
      const buf = await file.async('uint8array');
      mediaDataUrls[key] = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
    }
  }

  // Open SQLite
  const wasmBinary = readFileSync(join(process.cwd(), 'public/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });
  const dbBuf = await dbFile.async('uint8array');
  const db = new SQL.Database(dbBuf);

  // Deck map: id → name
  const colResult = db.exec('SELECT decks FROM col LIMIT 1');
  const decksJson = JSON.parse(colResult[0].values[0][0] as string) as Record<string, { id: number; name: string }>;
  const deckMap: Record<number, string> = {};
  for (const deck of Object.values(decksJson)) {
    deckMap[deck.id] = deck.name;
  }

  // Note → deck mapping
  const cardsResult = db.exec('SELECT nid, did FROM cards');
  const noteToDeckId: Record<number, number> = {};
  if (cardsResult.length > 0) {
    for (const [nid, did] of cardsResult[0].values) {
      noteToDeckId[nid as number] = did as number;
    }
  }

  // Notes
  const notesResult = db.exec('SELECT id, guid, flds, tags FROM notes');
  const cards: Card[] = [];

  if (notesResult.length > 0) {
    for (const row of notesResult[0].values) {
      const [noteId, guid, flds, tagsRaw] = row as [number, string, string, string];
      const sepIdx = (flds as string).indexOf(FIELD_SEP);
      const front = (flds as string).slice(0, sepIdx);
      let backHtml = (flds as string).slice(sepIdx + 1);

      const deckId = noteToDeckId[noteId];
      const deckName = deckMap[deckId] ?? 'Imported';

      // Parse tags: " aller indicatif_présent " → ['aller', 'indicatif présent']
      const tags = tagsRaw.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/_/g, ' '));

      // Extract image from backHtml, store separately so re-export can re-number media
      let imageDataUrl: string | undefined;
      const imgMatch = backHtml.match(/<img src="([^"]+)"[^>]*>\s*(?:<br\s*\/?>)?\s*/);
      if (imgMatch) {
        backHtml = backHtml.replace(imgMatch[0], '');
        const key = filenameToKey[imgMatch[1]];
        if (key) imageDataUrl = mediaDataUrls[key];
      }

      const type: Card['type'] = backHtml.includes('conj-table') ? 'photo' : 'word';

      cards.push({
        id: guid,
        type,
        deckName,
        front,
        back: backHtml,
        backHtml,
        createdAt: noteId,
        ...(tags.length > 0 ? { tags } : {}),
        ...(imageDataUrl ? { imageDataUrl } : {}),
      });
    }
  }

  db.close();

  const deckNames = [...new Set(cards.map((c) => c.deckName))];
  return NextResponse.json({ deckNames, cards });
}
