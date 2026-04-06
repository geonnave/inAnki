import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export interface TenseResult {
  tense: string;
  conjugations: string[];
}

export interface ScanResult {
  verb: string;
  tenses: TenseResult[];
}

export async function POST(req: NextRequest) {
  const { imageDataUrl } = await req.json();

  if (!imageDataUrl) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/webp';

  // Step 1: vision — detect verb and tenses from the photo
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
  let tenses: string[] = [];
  try {
    const clean = detectText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);
    verb = parsed.verb;
    tenses = parsed.tenses;
  } catch {
    return NextResponse.json({ error: 'Failed to parse verb/tenses', raw: detectText }, { status: 500 });
  }

  // Step 2: generate correct conjugations for each detected tense
  let conjugateText = '';
  try {
    const conjugateMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Give the correct French conjugations for the verb "${verb}" in these tenses: ${tenses.join(', ')}.

For each tense, list exactly 6 forms in order: je, tu, il/elle, nous, vous, ils/elles.
Use "il/elle" and "ils/elles" as the pronoun labels.

Respond with ONLY a JSON object (no markdown):
{
  "verb": "${verb}",
  "tenses": [
    {
      "tense": "<tense name>",
      "conjugations": ["je ...", "tu ...", "il/elle ...", "nous ...", "vous ...", "ils/elles ..."]
    }
  ]
}`,
      }],
    });
    conjugateText = conjugateMsg.content[0].type === 'text' ? conjugateMsg.content[0].text : '';
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Conjugation error: ${msg}` }, { status: 500 });
  }

  try {
    const clean = conjugateText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed: ScanResult = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to parse conjugations', raw: conjugateText }, { status: 500 });
  }
}
