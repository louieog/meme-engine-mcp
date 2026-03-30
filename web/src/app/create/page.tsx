"use client";

import { useState } from "react";

const formats = [
  { id: "mini-drama", name: "Mini Drama", description: "Short character-driven skits" },
  { id: "text-meme", name: "Text Meme", description: "Text overlays on video/image" },
  { id: "reaction", name: "Reaction", description: "Commentary on existing content" },
  { id: "skit", name: "Skit", description: "Short comedy scenes" },
];

const styles = [
  { id: "relatable", name: "Relatable", emoji: "😊" },
  { id: "absurdist", name: "Absurdist", emoji: "🤪" },
  { id: "wholesome", name: "Wholesome", emoji: "🥰" },
  { id: "dark-humor", name: "Dark Humor", emoji: "😈" },
  { id: "cinematic", name: "Cinematic", emoji: "🎬" },
];

export default function CreatePage() {
  const [concept, setConcept] = useState("");
  const [format, setFormat] = useState("mini-drama");
  const [style, setStyle] = useState("relatable");
  const [duration, setDuration] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          format,
          style,
          duration_target_seconds: duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create request");
      }

      setRequestId(data.request_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (requestId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-4">Request Created!</h1>
        <p className="text-gray-300 mb-8">
          Your meme video is being generated. This may take a few minutes.
        </p>
        <div className="glass rounded-xl p-6 mb-8">
          <div className="text-sm text-gray-400 mb-2">Request ID</div>
          <code className="text-lg font-mono text-purple-400">{requestId}</code>
        </div>
        <div className="flex gap-4 justify-center">
          <a
            href={`/status/${requestId}`}
            className="px-6 py-3 bg-purple-600 rounded-full font-semibold hover:bg-purple-700 transition-colors"
          >
            Check Status
          </a>
          <button
            onClick={() => {
              setRequestId(null);
              setConcept("");
            }}
            className="px-6 py-3 glass rounded-full font-semibold hover:bg-white/10 transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-2">Create a Meme Video</h1>
      <p className="text-gray-400 text-center mb-8">
        Describe your idea and let AI do the rest
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Concept Input */}
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            What&apos;s your meme concept?
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g., A funny cat video where the cat acts like a CEO in a business meeting..."
            className="w-full h-32 px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500 resize-none"
            required
          />
          <div className="text-right text-sm text-gray-500 mt-2">
            {concept.length} characters
          </div>
        </div>

        {/* Format Selection */}
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-4">
            Choose a format
          </label>
          <div className="grid grid-cols-2 gap-4">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  format === f.id
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div className="font-semibold mb-1">{f.name}</div>
                <div className="text-sm text-gray-400">{f.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Style Selection */}
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-4">
            Select a style
          </label>
          <div className="flex flex-wrap gap-3">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`px-4 py-2 rounded-full border-2 transition-all ${
                  style === s.id
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <span className="mr-2">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Slider */}
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-4">
            Target Duration: {duration} seconds
          </label>
          <input
            type="range"
            min={15}
            max={90}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>15s</span>
            <span>90s</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !concept.trim()}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-lg btn-glow transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              Creating...
            </span>
          ) : (
            "🚀 Generate Meme Video"
          )}
        </button>
      </form>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
