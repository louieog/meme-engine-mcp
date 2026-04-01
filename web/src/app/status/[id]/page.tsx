"use client";

import { useParams } from "next/navigation";
import { PipelineMonitor } from "@/components/PipelineMonitor";

export default function StatusPage() {
  const { id } = useParams();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-2">Pipeline Status</h1>
      <p className="text-gray-400 text-center mb-8">
        Request ID: <code className="text-purple-400">{id}</code>
      </p>
      <PipelineMonitor pipelineId={id as string} />
    </div>
  );
}
