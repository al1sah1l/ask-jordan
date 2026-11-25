import type { Activity, StorySummary } from "../api/client.ts";

/** Resolve navigation only against the authenticated user's server-supplied catalog. */
export function savedStoryLocation(url: URL, stories: StorySummary[], activities: Activity[]) {
  const story = stories.find(item => item.story === url.searchParams.get("story"));
  const activity = story && activities.find(item => item.activity === story.activity);
  return story && activity ? { storyId: story.story, activityName: activity.name } : null;
}

export function storyUrl(current: URL, storyId: string | null): URL {
  const url = new URL(current);
  if (storyId) url.searchParams.set("story", storyId);
  else url.searchParams.delete("story");
  return url;
}
