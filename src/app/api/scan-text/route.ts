import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { imageDataUrl } = await req.json();
  if (!imageDataUrl) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  const apiKey = req.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key provided' }, { status: 401 });
  const client = new Anthropic({ apiKey });

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

Your job: extract only items that a B2 learner genuinely would not know and that are worth memorizing. The bar is high. Most images will yield 0–3 items. Returning an empty array is correct and expected when the text is unremarkable.

Only include:
- Idiomatic or fixed expressions whose meaning is non-literal (e.g. "parler chiffons", "se déplacer de conserve", "n'avoir pas l'air de")
- Rare, literary, or formal single words that a B2 learner likely hasn't seen (e.g. "litote", "frémir", "goguenard")

Never include:
- Transparent cognates with Portuguese or English (hydratation, composition, minéral, naturelle, constante, adapté, quotidien, silence, conversation…)
- Common words and basic phrases (de nouveau, à côté de, quelques instants, deux heures plus tard, s'asseoir, camarade…)
- Sentences or sentence fragments lifted verbatim from the text — cards must be vocabulary items or expressions, not sentences
- Grammatical patterns that are standard at B2 (être adapté à, dont + clause, etc.)
- Anything from advertising, packaging, or generic informational text unless it contains a genuinely rare word or idiom

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
