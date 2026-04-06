import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

const client = new Anthropic();

export interface TenseResult {
  tense: string;
  conjugations: string[];
}

export interface ScanResult {
  verb: string;
  tenses: TenseResult[];
}

// Fetch all conjugations for a verb from gymglish (ground truth)
async function fetchGymglish(verb: string): Promise<Record<string, string[]>> {
  const url = `https://www.gymglish.com/fr/conjugaison/vatefaireconjuguer/verbe/${encodeURIComponent(verb.toLowerCase())}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; inanki/1.0)' },
  });
  if (!res.ok) throw new Error(`gymglish returned ${res.status} for "${verb}"`);
  const html = await res.text();
  const root = parse(html);

  const result: Record<string, string[]> = {};
  let currentMood = '';

  // Walk through h2.conjugation-mode and h3.tense-name elements in order
  const verbFormsStart = html.indexOf('<!-- VERB FORMS -->');
  if (verbFormsStart === -1) throw new Error('Could not find conjugation data on gymglish');

  const section = parse(html.slice(verbFormsStart));

  section.querySelectorAll('h2.conjugation-mode, h3.tense-name, ul.conjucation-forms').forEach((el) => {
    if (el.tagName === 'H2') {
      currentMood = el.text.trim();
    } else if (el.tagName === 'H3') {
      const tenseName = `${currentMood} ${el.text.trim()}`.toLowerCase().trim();
      const nextUl = el.nextElementSibling;
      if (nextUl && nextUl.tagName === 'UL') {
        const forms = nextUl.querySelectorAll('li').map((li) => {
          // Normalize il/elle: gymglish gives "il va/elle va" → "il/elle va"
          const raw = li.text.replace(/\s+/g, ' ').trim();
          return normalizeForm(raw);
        });
        result[tenseName] = forms;
      }
    }
  });

  // Also store tenses without mood prefix for flexible matching
  Object.entries({ ...result }).forEach(([key, val]) => {
    const withoutMood = key.replace(/^\w+ /, '');
    if (!result[withoutMood]) result[withoutMood] = val;
  });

  return result;
}

// "il va/elle va" → "il/elle va", "ils vont/elles vont" → "ils/elles vont"
function normalizeForm(raw: string): string {
  return raw
    .replace(/^il ([^/]+)\/elle \1$/, 'il/elle $1')
    .replace(/^il ([^/]+)\/elle ([^/]+)$/, 'il/elle $1')
    .replace(/^ils ([^/]+)\/elles \1$/, 'ils/elles $1')
    .replace(/^ils ([^/]+)\/elles ([^/]+)$/, 'ils/elles $1');
}

// Map Claude-detected tense names to gymglish keys (both lowercased)
function matchTense(detected: string, gymglishKeys: string[]): string | null {
  const d = detected.toLowerCase().trim();

  // Direct match
  if (gymglishKeys.includes(d)) return d;

  // Normalise common variations
  const aliases: Record<string, string[]> = {
    'indicatif présent':     ['présent', 'indicatif présent'],
    'indicatif imparfait':   ['imparfait', 'indicatif imparfait'],
    'indicatif passé composé': ['passé composé', 'indicatif passé composé'],
    'indicatif futur simple': ['futur', 'futur simple', 'indicatif futur', 'indicatif futur simple'],
    'futur proche':          ['futur proche', 'indicatif futur proche'],
    'conditionnel présent':  ['conditionnel présent', 'présent'],
    'subjonctif présent':    ['subjonctif présent', 'présent'],
  };

  const candidates = aliases[d] ?? [d];
  for (const candidate of candidates) {
    const match = gymglishKeys.find((k) => k === candidate || k.endsWith(candidate));
    if (match) return match;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { imageDataUrl } = await req.json();

  if (!imageDataUrl) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/webp';

  // Step 1: Claude vision — detect verb and tenses from the photo
  let detectText = '';
  try {
    const detectMsg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a handwritten French verb conjugation sheet.
Identify the verb and the list of tenses present.
If words are crossed out and corrected, use the corrected version.

Respond with ONLY a JSON object (no markdown):
{
  "verb": "<infinitive form>",
  "tenses": ["<tense 1>", "<tense 2>", ...]
}

Use these exact tense names when applicable:
indicatif présent, indicatif imparfait, indicatif passé composé, indicatif futur simple, futur proche, conditionnel présent, subjonctif présent`,
          },
        ],
      }],
    });
    detectText = detectMsg.content[0].type === 'text' ? detectMsg.content[0].text : '';
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Vision error: ${msg}` }, { status: 500 });
  }

  let verb = '';
  let detectedTenses: string[] = [];
  try {
    const clean = detectText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);
    verb = parsed.verb;
    detectedTenses = parsed.tenses;
  } catch {
    return NextResponse.json({ error: 'Failed to parse verb/tenses', raw: detectText }, { status: 500 });
  }

  // Step 2: fetch ground-truth conjugations from gymglish
  let gymglishData: Record<string, string[]>;
  try {
    gymglishData = await fetchGymglish(verb);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Gymglish error: ${msg}` }, { status: 500 });
  }

  const gymglishKeys = Object.keys(gymglishData);

  // Step 3: match detected tenses to gymglish data
  const tenses: TenseResult[] = detectedTenses.flatMap((detected) => {
    const key = matchTense(detected, gymglishKeys);
    if (!key || !gymglishData[key]) {
      console.warn(`[scan-conjugation] no gymglish match for "${detected}"`);
      return [];
    }
    return [{ tense: detected, conjugations: gymglishData[key] }];
  });

  return NextResponse.json({ verb, tenses } satisfies ScanResult);
}
