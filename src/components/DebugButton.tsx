'use client';

export default function DebugButton() {
  return (
    <button
      onClick={() => alert('JS works!')}
      className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
    >
      Test JS
    </button>
  );
}
