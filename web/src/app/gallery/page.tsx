"use client";

import { useEffect, useState } from "react";

interface VideoOutput {
  id: string;
  date: string;
  concept: string;
  slug: string;
  duration: number;
  thumbnail?: string;
  video_file: string;
  metadata?: any;
}

// Normalize metadata reading (handle both patterns)
function normalizeMetadata(video: VideoOutput) {
  // Try metadata field first
  if (video.metadata) return video.metadata;
  
  // Fallback
  return {
    concept: video.concept || 'Unknown',
    duration: video.duration || 0,
    createdAt: video.date || new Date().toISOString()
  };
}

// Get video URL in format: /api/outputs/{date}/{path}
function getVideoUrl(video: VideoOutput) {
  const date = video.date || new Date().toISOString().split('T')[0];
  const filePath = video.video_file;
  return `/api/outputs/${date}/${filePath}`;
}

// Get thumbnail URL
function getThumbnailUrl(video: VideoOutput) {
  if (video.thumbnail && !video.thumbnail.startsWith('http')) {
    const date = video.date || new Date().toISOString().split('T')[0];
    return `/api/outputs/${date}/${video.thumbnail}`;
  }
  return video.thumbnail;
}

export default function GalleryPage() {
  const [videos, setVideos] = useState<VideoOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/gallery");
      const data = await response.json();
      // Fix: data.videos -> data.outputs
      setVideos(data.outputs || []);
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🎬</div>
        <h1 className="text-3xl font-bold mb-4">No Videos Yet</h1>
        <p className="text-gray-400 mb-8">
          Create your first meme video to see it here
        </p>
        <a
          href="/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 rounded-full font-semibold hover:bg-purple-700 transition-colors"
        >
          Create Video
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Your Videos</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: VideoOutput }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const metadata = normalizeMetadata(video);
  const videoUrl = getVideoUrl(video);
  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <div
      className="glass rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-800 relative overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.concept}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl">
            🎬
          </div>
        )}
        {isHovered && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-4">
            <a
              href={videoUrl}
              download
              className="px-4 py-2 bg-purple-600 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Download
            </a>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold mb-1 line-clamp-2">{metadata.concept || video.concept}</h3>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{metadata.duration ? `${Math.round(metadata.duration)}s` : ''}</span>
          <span>{new Date(video.date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
