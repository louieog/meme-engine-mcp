export default function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" className="text-xl font-bold">Meme Engine</a>
        <nav className="flex gap-4">
          <a href="/create" className="text-sm hover:text-purple-400 transition-colors">Create</a>
          <a href="/gallery" className="text-sm hover:text-purple-400 transition-colors">Gallery</a>
        </nav>
      </div>
    </header>
  );
}
