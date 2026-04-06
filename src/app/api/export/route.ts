import { NextRequest, NextResponse } from 'next/server';
import { Card } from '@/lib/types';
import { buildApkg } from '@/lib/apkg';

export async function POST(req: NextRequest) {
  const { deckName, cards }: { deckName: string; cards: Card[] } = await req.json();

  if (!deckName || !cards?.length) {
    return NextResponse.json({ error: 'No deck or cards provided' }, { status: 400 });
  }

  let buffer;
  try {
    buffer = await buildApkg(deckName, cards);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[export] buildApkg error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${deckName}.apkg"`,
    },
  });
}
