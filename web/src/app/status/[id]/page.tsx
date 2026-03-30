"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PipelineStatus {
  request_id: string;
  status: string;
  stage: string;
  detail: string;
  progress?: {
    total_scenes: number;
    completed_scenes: number;
    current_scene?: number;
  };
  errors: Array<{ stage: string; error: string }>;
}

export default function StatusPage() {
  const params = useParams();
  const requestId = params.id as string;
  
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/requests?id=${requestId}`);
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 5000);

    return () => clearInterval(interval);
  }, [requestId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-bold mb-4">Request Not Found</h1>
        <p className="text-gray-400">
          Could not find a request with ID: {requestId}
        </p>
      </div>
    );
  }

  const isComplete = status.status === "complete";
  const isFailed = status.status === "failed";
  const progress = status.progress;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-2">Generation Status</h1>
      <p className="text-gray-400 text-center mb-8">
        Request ID: <code className="text-purple-400">{requestId}</code>
      </p>

      {/* Status Card */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400">Status</span>
          <StatusBadge status={status.status} />
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400">Stage</span>
          <span className="font-semibold capitalize">{status.stage}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Detail</span>
          <span className="text-right">{status.detail}</span>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-sm font-semibold">
              {progress.completed_scenes} / {progress.total_scenes} scenes
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
              style={{
                width: `${(progress.completed_scenes / progress.total_scenes) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {status.errors.length > 0 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-red-200 mb-3">Errors</h3>
          <ul className="space-y-2">
            {status.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-200">
                <span className="font-medium">{error.stage}:</span> {error.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {isComplete && (
        <div className="text-center">
          <a
            href="/gallery"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 rounded-full font-semibold hover:bg-green-700 transition-colors"
          >
            <span>🎉</span>
            View Your Videos
          </a>
        </div>
      )}

      {isFailed && (
        <div className="text-center">
          <a
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 rounded-full font-semibold hover:bg-purple-700 transition-colors"
          >
            Try Again
          </a>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-500",
    generating: "bg-blue-500",
    brief_ready: "bg-purple-500",
    complete: "bg-green-500",
    failed: "bg-red-500",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] || "bg-gray-500"}`}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}
