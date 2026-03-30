"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-6xl font-bold mb-6">
          <span className="gradient-text">Create Viral Memes</span>
          <br />
          <span className="text-white">with AI</span>
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          Generate hilarious meme videos in minutes using ComfyUI Cloud and 
          Anthropic&apos;s Model Context Protocol.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-lg btn-glow transition-all hover:scale-105"
        >
          <span>🚀</span>
          Start Creating
        </Link>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8">
        <FeatureCard
          icon="🎨"
          title="AI-Powered Generation"
          description="Create unique meme videos with state-of-the-art AI models including Gemini, Kling, and ElevenLabs."
        />
        <FeatureCard
          icon="⚡"
          title="Lightning Fast"
          description="Generate videos in minutes with optimized pipelines and automatic model fallback chains."
        />
        <FeatureCard
          icon="📱"
          title="Multi-Format Export"
          description="Automatically export in 9:16 (TikTok/Reels) and 16:9 (YouTube) formats."
        />
      </section>

      {/* How It Works */}
      <section className="glass rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <Step number={1} title="Describe Your Idea" description="Enter a concept or trending topic" />
          <Step number={2} title="AI Creates Brief" description="We generate a production brief with scenes" />
          <Step number={3} title="Generate Assets" description="AI creates images, video, and audio" />
          <Step number={4} title="Download & Share" description="Get your meme video ready to post" />
        </div>
      </section>

      {/* Formats */}
      <section className="text-center">
        <h2 className="text-3xl font-bold mb-8">Supported Formats</h2>
        <div className="flex justify-center gap-8">
          <FormatBadge name="TikTok" ratio="9:16" icon="📱" />
          <FormatBadge name="Reels" ratio="9:16" icon="📸" />
          <FormatBadge name="Shorts" ratio="9:16" icon="▶️" />
          <FormatBadge name="YouTube" ratio="16:9" icon="🎬" />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center hover:bg-white/10 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center font-bold text-xl mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function FormatBadge({ name, ratio, icon }: { name: string; ratio: string; icon: string }) {
  return (
    <div className="glass rounded-xl px-6 py-4 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold">{name}</div>
      <div className="text-sm text-gray-400">{ratio}</div>
    </div>
  );
}
