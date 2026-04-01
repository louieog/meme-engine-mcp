"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle, Film, Image, Mic, Volume2 } from "lucide-react";

interface SceneStatus {
  id: number;
  status: "pending" | "generating" | "completed" | "failed";
  assets: {
    image?: string;
    video?: string;
    audio?: string;
  };
}

interface PipelineStatus {
  id: string;
  status: string;
  progress: number;
  currentStage: string;
  scenes: SceneStatus[];
  outputs?: {
    "16:9"?: string;
    "9:16"?: string;
  };
  error?: string;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  briefing: <Film className="w-4 h-4" />,
  images: <Image className="w-4 h-4" />,
  videos: <Film className="w-4 h-4" />,
  audio: <Mic className="w-4 h-4" />,
  assembly: <Volume2 className="w-4 h-4" />,
  export: <CheckCircle className="w-4 h-4" />,
};

const STAGE_NAMES: Record<string, string> = {
  pending: "Waiting to start...",
  briefing: "Creating production brief...",
  images: "Generating scene images...",
  videos: "Generating videos...",
  audio: "Generating audio & lip sync...",
  assembly: "Assembling final video...",
  export: "Exporting formats...",
  completed: "Complete!",
  failed: "Failed",
};

export function PipelineMonitor({ pipelineId }: { pipelineId: string }) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/requests/${pipelineId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatus(data);
        
        // Fetch logs if available
        const logsRes = await fetch(`/api/requests/${pipelineId}/logs`);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData.logs || []);
        }
        
        // Stop polling when complete or failed
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    }
    
    // Poll every 3 seconds
    fetchStatus();
    interval = setInterval(fetchStatus, 3000);
    
    return () => clearInterval(interval);
  }, [pipelineId]);

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 border border-red-500/50">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="w-5 h-5" />
          <p>Error loading status: {error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading pipeline status...</p>
        </div>
      </div>
    );
  }

  const isComplete = status.status === "completed";
  const isFailed = status.status === "failed";

  const getStatusBadgeClass = () => {
    if (isComplete) return "bg-green-500/20 text-green-400 border-green-500/50";
    if (isFailed) return "bg-red-500/20 text-red-400 border-red-500/50";
    return "bg-purple-500/20 text-purple-400 border-purple-500/50";
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {STAGE_ICONS[status.status] || <Loader2 className="w-4 h-4 animate-spin" />}
            <span className="font-semibold">
              {STAGE_NAMES[status.status] || status.status}
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadgeClass()}`}>
            {status.progress}%
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">{status.currentStage}</p>
      </div>

      {/* Scene Progress */}
      {status.scenes && status.scenes.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Scenes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {status.scenes.map((scene) => (
              <div
                key={scene.id}
                className={`p-3 rounded-xl border ${
                  scene.status === "completed"
                    ? "bg-green-500/10 border-green-500/30"
                    : scene.status === "failed"
                    ? "bg-red-500/10 border-red-500/30"
                    : scene.status === "generating"
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Scene {scene.id}</span>
                  {scene.status === "completed" && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {scene.status === "failed" && <XCircle className="w-4 h-4 text-red-400" />}
                  {scene.status === "generating" && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {scene.assets.image && "✓ Image"}
                  {scene.assets.video && " ✓ Video"}
                  {scene.assets.audio && " ✓ Audio"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Outputs */}
      {isComplete && status.outputs && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Final Outputs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {status.outputs["16:9"] && (
              <div>
                <p className="text-sm font-medium mb-2 text-gray-300">16:9 (Landscape)</p>
                <video
                  src={status.outputs["16:9"]}
                  controls
                  className="w-full rounded-lg"
                  poster={status.outputs["16:9"].replace(".mp4", "_thumb.jpg")}
                />
              </div>
            )}
            {status.outputs["9:16"] && (
              <div>
                <p className="text-sm font-medium mb-2 text-gray-300">9:16 (Vertical)</p>
                <video
                  src={status.outputs["9:16"]}
                  controls
                  className="w-full rounded-lg max-h-[500px] mx-auto"
                  poster={status.outputs["9:16"].replace(".mp4", "_thumb.jpg")}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {isFailed && status.error && (
        <div className="glass rounded-2xl p-6 border border-red-500/50 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Pipeline Failed</span>
          </div>
          <p className="text-red-200 text-sm">{status.error}</p>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Generation Log</h3>
          <div className="bg-black/30 p-4 rounded-xl font-mono text-xs max-h-64 overflow-y-auto text-gray-300">
            {logs.map((log, i) => (
              <div key={i} className="py-0.5">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
