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

Extract French words or expressions that are worth learning as vocabulary for an intermediate learner. Skip very basic words (articles like le/la/les, basic prepositions like de/à/en, conjunctions like et/ou, etc.).

For each item worth learning, produce a flashcard. The learner is a native Portuguese (BR) speaker learning French from English.

Respond with ONLY a JSON object (no markdown):
{
  "items": [
    {
      "front": "<French word or expression>",
      "back": "🇺🇸 <English translation>\\n🇧🇷 <Portuguese (BR) translation>\\n\\nExample: <short French example sentence (English translation in parentheses)>"
    }
  ]
}

If no learnable French content is found in the image, return { "items": [] }.`,
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
