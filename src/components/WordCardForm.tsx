'use client';

import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { Card } from '@/lib/types';
import { getApiKey } from '@/lib/apikey';

interface Props {
  deckName: string;
  onAdd: (card: Card) => void;
}

export default function WordCardForm({ deckName, onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [preview, setPreview] = useState<{ front: string; back: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEnrich() {
    const word = inputRef.current?.value.trim() ?? '';
    if (!word) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const client = new Anthropic({ apiKey: getApiKey()!, dangerouslyAllowBrowser: true });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `You are a French language teacher. Given a French word or expression, produce a flashcard.

Word: "${word}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "front": "<the French word or expression>",
  "back": "🇺🇸 <English translation>\\n🇧🇷 <Portuguese (BR) translation>\\n\\nExample: <one short example sentence in French with English translation in parentheses>"
}`,
        }],
      });
      const raw = message.content[0].type === 'text' ? message.content[0].text : '';
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      setPreview(JSON.parse(text));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    if (!preview) return;
    onAdd({
      id: uuidv4(),
      type: 'word',
      deckName,
      front: preview.front,
      back: preview.back,
      createdAt: Date.now(),
    });
    if (inputRef.current) inputRef.current.value = '';
    setHasContent(false);
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          onChange={(e) => setHasContent(e.target.value.trim().length > 0)}
          onKeyDown={(e) => e.key === 'Enter' && handleEnrich()}
          placeholder="French word or expression..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          autoFocus
        />
        <button
          onClick={handleEnrich}
          disabled={!hasContent || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          {loading ? '...' : 'Enrich'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {preview && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Front</span>
            <p className="mt-1 text-gray-900 font-medium">{preview.front}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Back</span>
            <p className="mt-1 text-gray-700 whitespace-pre-line">{preview.back}</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              Add to deck
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
