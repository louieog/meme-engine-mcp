"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function BriefReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setBrief(data.brief);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load brief:", err);
        setLoading(false);
      });
  }, [id]);

  async function handleApprove() {
    await fetch(`/api/requests/${id}/start`, { method: "POST" });
    router.push(`/status/${id}`);
  }

  async function handleRevise(feedbackText: string) {
    await fetch(`/api/requests/${id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: feedbackText }),
    });
    // Refresh to get updated brief
    window.location.reload();
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!brief) return <div className="p-8 text-center">Brief not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Review Production Brief</h1>

      {/* Concept */}
      <Card>
        <CardHeader>
          <CardTitle>Concept</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{brief.concept}</p>
          <div className="flex gap-2 mt-2">
            <Badge>{brief.format}</Badge>
            <Badge variant="outline">{brief.style}</Badge>
            <Badge variant="outline">{brief.duration_target_seconds}s</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Scenes */}
      <Card>
        <CardHeader>
          <CardTitle>Scenes ({brief.scenes?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brief.scenes?.map((scene: any) => (
            <div key={scene.scene_id} className="p-4 border rounded-lg">
              <div className="flex justify-between">
                <h3 className="font-semibold">
                  Scene {scene.scene_id}: {scene.beat}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {scene.duration_seconds}s
                </span>
              </div>
              <p className="text-sm mt-2">{scene.visual}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Camera: {scene.camera}
              </p>
              {scene.dialogue?.length > 0 && (
                <div className="mt-2 text-sm">
                  {scene.dialogue.map((d: any, i: number) => (
                    <p key={i}>
                      <strong>{d.character}:</strong> &ldquo;{d.line}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selected Models</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Image</dt>
              <dd>{brief.generation_requirements?.models_preferred?.image || "auto"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Video</dt>
              <dd>{brief.generation_requirements?.models_preferred?.video || "auto"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">TTS</dt>
              <dd>{brief.generation_requirements?.models_preferred?.tts || "auto"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Lip Sync</dt>
              <dd>{brief.generation_requirements?.models_preferred?.lip_sync || "auto"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={handleApprove} size="lg">
          Looks Good — Generate Video
        </Button>
        <Dialog>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 border border-border bg-transparent text-foreground hover:bg-secondary h-10 px-4 py-2">
            Request Changes
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revise Brief</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="What would you like to change?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
            />
            <Button onClick={() => handleRevise(feedback)} className="mt-4">
              Submit Feedback
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
