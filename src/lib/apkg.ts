import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Card } from './types';

// Anki uses a field separator of 0x1f
const FIELD_SEP = '\x1f';

function now() {
  return Math.floor(Date.now() / 1000);
}

// Derive a stable Anki-compatible ID (millisecond timestamp range) from a UUID.
// We take 10 decimal digits of the UUID's numeric hash and clamp it to a valid
// ms-since-epoch range (2000–2100) so Anki doesn't flag it as a future timestamp.
function uuidToAnkiId(uuid: string, offset = 0): number {
  const hex = uuid.replace(/-/g, '');
  // Use middle 10 hex digits to get a number in ~0–1e12 range
  const raw = parseInt(hex.slice(8, 18), 16); // max ~1.099e12
  // Clamp into 2000-01-01 (946684800000ms) to 2099-12-31 (4102444800000ms)
  const MIN = 946684800000;
  const MAX = 4102444800000;
  return MIN + (raw % (MAX - MIN)) + offset;
}

// Convert plain-text back (with \n) into structured HTML for Anki rendering.
// Expected format:
//   🇺🇸 translation\n🇧🇷 translation\n\nExample: sentence
function formatBackAsHtml(back: string): string {
  const [translationBlock, ...rest] = back.split(/\n\nExample:/i);
  const translationLines = translationBlock.split('\n').filter(Boolean);
  const translationsHtml = translationLines
    .map((line) => `<div class="translation-line">${line}</div>`)
    .join('');
  const exampleHtml = rest.length
    ? `<div class="example"><strong>Example:</strong> ${rest.join('').trim()}</div>`
    : '';
  return `<div class="translations">${translationsHtml}</div>${exampleHtml}`;
}

// Simple checksum used by Anki for the sfld column
function fieldChecksum(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function buildApkg(deckName: string, cards: Card[]): Promise<Buffer> {
  const wasmBinary = readFileSync(join(process.cwd(), 'public/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });
  const db = new SQL.Database();

  const deckId = Date.now();
  const modelId = deckId - 1;
  const ts = now();

  // --- Schema ---
  db.run(`
    CREATE TABLE col (
      id integer primary key, crt integer not null, mod integer not null,
      scm integer not null, ver integer not null, dty integer not null,
      usn integer not null, ls integer not null, conf text not null,
      models text not null, decks text not null, dconf text not null,
      tags text not null
    );
    CREATE TABLE notes (
      id integer primary key, guid text not null, mid integer not null,
      mod integer not null, usn integer not null, tags text not null,
      flds text not null, sfld integer not null, csum integer not null,
      flags integer not null, data text not null
    );
    CREATE TABLE cards (
      id integer primary key, nid integer not null, did integer not null,
      ord integer not null, mod integer not null, usn integer not null,
      type integer not null, queue integer not null, due integer not null,
      ivl integer not null, factor integer not null, reps integer not null,
      lapses integer not null, left integer not null, odue integer not null,
      odid integer not null, flags integer not null, data text not null
    );
    CREATE TABLE revlog (
      id integer primary key, cid integer not null, usn integer not null,
      ease integer not null, ivl integer not null, lastIvl integer not null,
      factor integer not null, time integer not null, type integer not null
    );
    CREATE TABLE graves (
      usn integer not null, oid integer not null, type integer not null
    );
  `);

  // --- Model (Basic) ---
  const model = {
    id: modelId,
    name: 'Basic',
    type: 0,
    mod: ts,
    usn: -1,
    sortf: 0,
    did: deckId,
    tmpls: [
      {
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
        bfont: '',
        bsize: 0,
      },
    ],
    flds: [
      { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20 },
      { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20 },
    ],
    css: `
.card {
  font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  text-align: center;
  color: #1a1a1a;
  background-color: #ffffff;
  padding: 20px;
  line-height: 1.6;
}
.translations {
  font-size: 20px;
  margin-bottom: 16px;
}
.translation-line {
  margin: 4px 0;
}
.example {
  font-size: 15px;
  color: #555;
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
  margin-top: 12px;
  font-style: italic;
}
`,
    latexPre: '',
    latexPost: '',
    vers: [],
    tags: [],
    req: [[0, 'any', [0]]],
  };

  // --- Deck ---
  const deck = {
    id: deckId,
    name: deckName,
    desc: '',
    extendRev: 50,
    usn: -1,
    collapsed: false,
    newToday: [0, 0],
    timeToday: [0, 0],
    dyn: 0,
    extendNew: 10,
    conf: 1,
    revToday: [0, 0],
    lrnToday: [0, 0],
    mod: ts,
    mid: modelId,
  };

  const dconf = {
    1: {
      id: 1, name: 'Default', replayq: true, lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
      rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
      timer: 0, maxTaken: 60, usn: -1, new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
      mod: ts, autoplay: true,
    },
  };

  // Insert col row
  db.run(
    `INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      1, ts, ts, ts, 11, 0, -1, 0,
      JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [deckId], sortType: 'noteFld', timeLim: 0, collapsed: false, bulkAdd: true, newSpread: 0, dueCounts: true, curNote: null, newBury: true, manualSync: false, revBury: false, sortBackwards: false, addToCur: true, dayLearnFirst: false, schedVer: 2 }),
      JSON.stringify({ [modelId]: model }),
      JSON.stringify({ [deckId]: deck }),
      JSON.stringify(dconf),
      JSON.stringify({}),
    ]
  );

  // Insert notes + cards
  const mediaMap: Record<string, Buffer> = {};
  let mediaIndex = 0;

  for (const card of cards) {
    const noteId = uuidToAnkiId(card.id, 0);
    const cardId = uuidToAnkiId(card.id, 1);

    let backContent = formatBackAsHtml(card.back);
    if (card.imageDataUrl) {
      const mediaFilename = `${mediaIndex}.jpg`;
      const base64 = card.imageDataUrl.split(',')[1];
      mediaMap[mediaIndex.toString()] = Buffer.from(base64, 'base64');
      mediaIndex++;
      backContent = `<img src="${mediaFilename}" /><br/>` + backContent;
    }

    const flds = `${card.front}${FIELD_SEP}${backContent}`;
    const csum = fieldChecksum(card.front);

    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [noteId, card.id, modelId, ts, -1, '', flds, card.front, csum, 0, '']
    );

    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId, noteId, deckId, 0, ts, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '']
    );
  }

  const dbBuf = db.export();
  db.close();

  // Build .apkg zip
  const zip = new JSZip();
  zip.file('collection.anki2', dbBuf);
  zip.file('media', JSON.stringify(Object.fromEntries(
    Object.entries(mediaMap).map(([k]) => [k, `${k}.jpg`])
  )));
  for (const [idx, buf] of Object.entries(mediaMap)) {
    zip.file(idx, buf);
  }

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return zipBuf;
}
