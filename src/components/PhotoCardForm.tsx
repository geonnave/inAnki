'use client';

import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '@/lib/types';
import { apiFetch } from '@/lib/apikey';
import { ScanResult, TenseResult } from '@/app/api/scan-conjugation/route';

type PhotoMode = 'conjugation' | 'generic';

interface Props {
  deckName: string;
  onAdd: (cards: Card[]) => void;
}

export default function PhotoCardForm({ deckName, onAdd }: Props) {
  const [mode, setMode] = useState<PhotoMode>('conjugation');

  function switchMode(m: PhotoMode) {
    setMode(m);
    setImageDataUrl(null);
    setResult(null);
    setGenericCards([]);
    setChecked({});
    setLog([]);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [log, setLog] = useState<{ msg: string; secs?: number; done: boolean }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [genericCards, setGenericCards] = useState<{ front: string; back: string }[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageDataUrl(canvas.toDataURL('image/jpeg', 0.85));
        setResult(null);
        setError('');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageDataUrl) return;
    setError('');
    setResult(null);
    setLog([]);
    setScanning(true);

    const addLog = (msg: string) =>
      setLog((prev) => [...prev, { msg, done: false }]);

    const completeLog = (secs: number) =>
      setLog((prev) => prev.map((e, i) => i === prev.length - 1 ? { ...e, done: true, secs } : e));

    try {
      let t = Date.now();
      addLog('Analysing photo...');
      const detectRes = await apiFetch('/api/detect-verb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const detected = await detectRes.json();
      if (detected.error) throw new Error(detected.error);
      completeLog(Math.round((Date.now() - t) / 100) / 10);

      t = Date.now();
      addLog(`Found "${detected.verb}" — fetching conjugations...`);
      const conjugateRes = await apiFetch('/api/scan-conjugation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verb: detected.verb, tenses: detected.tenses }),
      });
      const data = await conjugateRes.json();
      if (data.error) throw new Error(data.error);
      completeLog(Math.round((Date.now() - t) / 100) / 10);

      addLog(`${data.tenses.length} tenses ready`);
      completeLog(0);

      const initialChecked: Record<string, boolean> = {};
      data.tenses.forEach((t: TenseResult) => { initialChecked[t.tense] = true; });
      setResult(data);
      setChecked(initialChecked);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setScanning(false);
    }
  }

  async function handleGenericScan() {
    if (!imageDataUrl) return;
    setError('');
    setGenericCards([]);
    setLog([]);
    setScanning(true);

    const addLog = (msg: string) => setLog((prev) => [...prev, { msg, done: false }]);
    const completeLog = (secs: number) =>
      setLog((prev) => prev.map((e, i) => i === prev.length - 1 ? { ...e, done: true, secs } : e));

    try {
      const t = Date.now();
      addLog('Analysing photo...');
      const res = await apiFetch('/api/scan-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      completeLog(Math.round((Date.now() - t) / 100) / 10);

      const items: { front: string; back: string }[] = data.items ?? [];
      if (items.length === 0) {
        addLog('No learnable French content found');
        completeLog(0);
      } else {
        addLog(`${items.length} word${items.length !== 1 ? 's' : ''} found`);
        completeLog(0);
        const initialChecked: Record<string, boolean> = {};
        items.forEach((_, i) => { initialChecked[String(i)] = true; });
        setGenericCards(items);
        setChecked(initialChecked);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setScanning(false);
    }
  }

  function handleAddCards() {
    if (!result) return;
    const now = Date.now();
    const cards: Card[] = result.tenses
      .filter((t) => checked[t.tense])
      .map((t, i) => ({
        id: uuidv4(),
        type: 'photo' as const,
        deckName,
        front: `${result.verb} — ${t.tense}`,
        back: t.conjugations.join('\n'),
        createdAt: now + i,
        tags: [result.verb, t.tense],
      }));
    if (cards.length === 0) return;
    onAdd(cards);
    setImageDataUrl(null);
    setResult(null);
    setChecked({});
    setLog([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleAddGenericCards() {
    const now = Date.now();
    const cards: Card[] = genericCards
      .filter((_, i) => checked[String(i)])
      .map((item, i) => ({
        id: uuidv4(),
        type: 'word' as const,
        deckName,
        front: item.front,
        back: item.back,
        createdAt: now + i,
      }));
    if (cards.length === 0) return;
    onAdd(cards);
    setImageDataUrl(null);
    setGenericCards([]);
    setChecked({});
    setLog([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-4">

      {/* Mode toggle */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
        {(['conjugation', 'generic'] as PhotoMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'conjugation' ? 'Conjugation' : 'Generic'}
          </button>
        ))}
      </div>

      {/* Shared hidden file input for both modes */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {mode === 'generic' ? (
        <div className="space-y-4">

          {!imageDataUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-3 bg-gray-50 hover:border-indigo-400 transition-colors"
            >
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-500">Take photo of French text</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img src={imageDataUrl} alt="French text" className="w-full rounded-xl object-cover max-h-48" />
                <button
                  onClick={() => { setImageDataUrl(null); setGenericCards([]); setLog([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              {genericCards.length === 0 && !scanning && log.length === 0 && (
                <button
                  onClick={handleGenericScan}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Scan text
                </button>
              )}

              {log.length > 0 && (
                <div className="rounded-xl bg-gray-950 px-4 py-3 space-y-1.5 font-mono text-xs">
                  {log.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {!entry.done && scanning ? (
                        <svg className="animate-spin w-3 h-3 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      ) : (
                        <span className="text-green-400 shrink-0">✓</span>
                      )}
                      <span className="text-gray-200">{entry.msg}</span>
                      {entry.done && entry.secs !== undefined && entry.secs > 0 && (
                        <span className="text-gray-500 ml-auto">{entry.secs}s</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {genericCards.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                {genericCards.map((item, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 border border-gray-200 rounded-xl p-3 bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked[String(i)] ?? true}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [String(i)]: e.target.checked }))}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.front}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.back.split('\n').slice(0, 2).join(' · ')}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddGenericCards}
                  disabled={checkedCount === 0}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-green-700 transition-colors"
                >
                  Add {checkedCount} card{checkedCount !== 1 ? 's' : ''} to deck
                </button>
                <button
                  onClick={() => { setGenericCards([]); setImageDataUrl(null); setLog([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">

          {!imageDataUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-3 bg-gray-50 hover:border-indigo-400 transition-colors"
            >
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-500">Take photo of conjugation sheet</span>
            </button>
          ) : (
            <div className="space-y-3">
              {/* Thumbnail + retake */}
              <div className="relative">
                <img src={imageDataUrl} alt="Conjugation sheet" className="w-full rounded-xl object-cover max-h-48" />
                <button
                  onClick={() => { setImageDataUrl(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              {!result && !scanning && log.length === 0 && (
                <button
                  onClick={handleScan}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Scan conjugations
                </button>
              )}

              {log.length > 0 && (
                <div className="rounded-xl bg-gray-950 px-4 py-3 space-y-1.5 font-mono text-xs">
                  {log.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {!entry.done && scanning ? (
                        <svg className="animate-spin w-3 h-3 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      ) : (
                        <span className="text-green-400 shrink-0">✓</span>
                      )}
                      <span className="text-gray-200">{entry.msg}</span>
                      {entry.done && entry.secs !== undefined && entry.secs > 0 && (
                        <span className="text-gray-500 ml-auto">{entry.secs}s</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <p className="font-semibold text-gray-900 text-lg">{result.verb}</p>
              <div className="space-y-2">
                {result.tenses.map((t) => (
                  <label
                    key={t.tense}
                    className="flex items-start gap-3 border border-gray-200 rounded-xl p-3 bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked[t.tense] ?? true}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [t.tense]: e.target.checked }))}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{t.tense}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.conjugations.join(' · ')}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCards}
                  disabled={checkedCount === 0}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-green-700 transition-colors"
                >
                  Add {checkedCount} card{checkedCount !== 1 ? 's' : ''} to deck
                </button>
                <button
                  onClick={() => { setResult(null); setImageDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
