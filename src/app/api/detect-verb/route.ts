import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

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
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
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
