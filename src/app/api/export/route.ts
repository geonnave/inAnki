import { NextRequest, NextResponse } from 'next/server';
import { Card } from '@/lib/types';
import { buildApkg } from '@/lib/apkg';

export async function POST(req: NextRequest) {
  const { deckName, cards }: { deckName: string; cards: Card[] } = await req.json();

  if (!deckName || !cards?.length) {
    return NextResponse.json({ error: 'No deck or cards provided' }, { status: 400 });
  }

  const buffer = await buildApkg(deckName, cards);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${deckName}.apkg"`,
    },
  });
}
