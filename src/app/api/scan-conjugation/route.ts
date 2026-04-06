import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

export interface TenseResult {
  tense: string;
  conjugations: string[];
}

export interface ScanResult {
  verb: string;
  tenses: TenseResult[];
}

async function fetchGymglish(verb: string): Promise<Record<string, string[]>> {
  const url = `https://www.gymglish.com/fr/conjugaison/vatefaireconjuguer/verbe/${encodeURIComponent(verb.toLowerCase())}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; inanki/1.0)' },
  });
  if (!res.ok) throw new Error(`gymglish returned ${res.status} for "${verb}"`);
  const html = await res.text();

  const verbFormsStart = html.indexOf('<!-- VERB FORMS -->');
  if (verbFormsStart === -1) throw new Error('Could not find conjugation data on gymglish');

  const section = parse(html.slice(verbFormsStart));
  const result: Record<string, string[]> = {};
  let currentMood = '';

  section.querySelectorAll('h2.conjugation-mode, h3.tense-name, ul.conjucation-forms').forEach((el) => {
    if (el.tagName === 'H2') {
      currentMood = el.text.trim();
    } else if (el.tagName === 'H3') {
      const tenseName = `${currentMood} ${el.text.trim()}`.toLowerCase().trim();
      const nextUl = el.nextElementSibling;
      if (nextUl && nextUl.tagName === 'UL') {
        result[tenseName] = nextUl.querySelectorAll('li').map((li) =>
          normalizeForm(li.text.replace(/\s+/g, ' ').trim())
        );
      }
    }
  });

  // Also index without mood prefix for flexible matching
  Object.entries({ ...result }).forEach(([key, val]) => {
    const withoutMood = key.replace(/^\S+ /, '');
    if (!result[withoutMood]) result[withoutMood] = val;
  });

  return result;
}

function normalizeForm(raw: string): string {
  return raw
    .replace(/^il ([^/]+)\/elle \1$/, 'il/elle $1')
    .replace(/^il ([^/]+)\/elle ([^/]+)$/, 'il/elle $1')
    .replace(/^ils ([^/]+)\/elles \1$/, 'ils/elles $1')
    .replace(/^ils ([^/]+)\/elles ([^/]+)$/, 'ils/elles $1');
}

function matchTense(detected: string, keys: string[]): string | null {
  const d = detected.toLowerCase().trim();
  if (keys.includes(d)) return d;

  const aliases: Record<string, string[]> = {
    'indicatif présent':       ['présent', 'indicatif présent'],
    'indicatif imparfait':     ['imparfait', 'indicatif imparfait'],
    'indicatif passé composé': ['passé composé', 'indicatif passé composé'],
    'indicatif futur simple':  ['futur', 'futur simple', 'indicatif futur', 'indicatif futur simple'],
    'futur proche':            ['futur proche', 'indicatif futur proche'],
    'conditionnel présent':    ['conditionnel présent'],
    'subjonctif présent':      ['subjonctif présent'],
  };

  for (const candidate of (aliases[d] ?? [d])) {
    const match = keys.find((k) => k === candidate || k.endsWith(candidate));
    if (match) return match;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { verb, tenses }: { verb: string; tenses: string[] } = await req.json();
  if (!verb || !tenses?.length) {
    return NextResponse.json({ error: 'verb and tenses required' }, { status: 400 });
  }

  let gymglishData: Record<string, string[]>;
  try {
    gymglishData = await fetchGymglish(verb);
  } catch (e: unknown) {
    return NextResponse.json({ error: `Gymglish error: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  const keys = Object.keys(gymglishData);
  const result: TenseResult[] = tenses.flatMap((detected) => {
    const key = matchTense(detected, keys);
    if (!key) { console.warn(`[scan-conjugation] no match for "${detected}"`); return []; }
    return [{ tense: detected, conjugations: gymglishData[key] }];
  });

  return NextResponse.json({ verb, tenses: result } satisfies ScanResult);
}
