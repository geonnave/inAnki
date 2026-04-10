import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { word } = await req.json();
  const apiKey = req.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key provided' }, { status: 401 });
  const client = new Anthropic({ apiKey });

  if (!word?.trim()) {
    return NextResponse.json({ error: 'No word provided' }, { status: 400 });
  }

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are a French language teacher. Given a French word or expression, produce a flashcard.

Word: "${word.trim()}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "front": "<the French word or expression>",
  "back": "🇺🇸 <English translation>\\n🇧🇷 <Portuguese (BR) translation>\\n\\nExample: <one short example sentence in French with English translation in parentheses>"
}`,
        },
      ],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[enrich] Anthropic API error:', msg);
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 500 });
  }

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch {
    console.error('[enrich] Failed to parse AI response:', raw);
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 });
  }
}
