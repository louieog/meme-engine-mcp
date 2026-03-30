import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meme Engine MCP",
  description: "AI-powered viral meme video generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
        <nav className="border-b border-white/10 bg-black/20 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3">
                <span className="text-2xl">🎬</span>
                <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Meme Engine MCP
                </span>
              </a>
              <div className="flex gap-6">
                <a href="/" className="hover:text-purple-400 transition-colors">Home</a>
                <a href="/create" className="hover:text-purple-400 transition-colors">Create</a>
                <a href="/gallery" className="hover:text-purple-400 transition-colors">Gallery</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
