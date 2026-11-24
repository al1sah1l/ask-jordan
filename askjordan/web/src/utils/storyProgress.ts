import type { ProgressiveStage } from "../api/client.ts";

const stages: Record<ProgressiveStage, { percent: number; label: string }> = {
  "first-choice": { percent: 25, label: "First decision" },
  "second-choice": { percent: 50, label: "Second decision" },
  "awaiting-reflection": { percent: 75, label: "Mini challenge" },
  reflected: { percent: 100, label: "Chapter complete" },
};

export function chapterProgress(stage?: ProgressiveStage) {
  return stage ? stages[stage] : { percent: 0, label: "Not started" };
}
