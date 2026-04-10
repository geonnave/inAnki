import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageDataUrl } = await req.json();
  if (!imageDataUrl) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/webp';

  let text = '';
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `Analyze this image. It may contain French text (a sign, menu, page, handwritten note, etc.).

The learner is a native Portuguese (BR) speaker at B2 French level, learning French from English.

Extract only items that are genuinely worth adding to flashcards at this level. Be selective and strict — quality over quantity.

Include:
- Idiomatic expressions and fixed phrases (e.g. "parler chiffons", "se déplacer de conserve", "avoir l'air de")
- Figurative or literary devices (e.g. "litote", "euphémisme")
- Less common or formal vocabulary that a B2 learner may not know
- Grammatical constructions worth memorizing

Skip:
- Basic or high-frequency words (camarade, s'asseoir, nouveau, instants, etc.)
- Transparent cognates with Portuguese or English (e.g. "camarade" ≈ "camarada", "silence", "conversation")
- Simple time/quantity phrases (deux heures plus tard, quelques instants, de nouveau, à côté de, quelques-uns)
- Anything a B2 learner almost certainly already knows

For each selected item, produce a flashcard.

Respond with ONLY a JSON object (no markdown):
{
  "items": [
    {
      "front": "<French word or expression>",
      "back": "🇺🇸 <English translation>\\n🇧🇷 <Portuguese (BR) translation>\\n\\nExample: <short French example sentence (English translation in parentheses)>"
    }
  ]
}

If nothing meets the bar, return { "items": [] }.`,
          },
        ],
      }],
    });
    text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  } catch (e: unknown) {
    return NextResponse.json({ error: `Vision error: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }

  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json({ error: 'Failed to parse response', raw: text }, { status: 500 });
  }
}
