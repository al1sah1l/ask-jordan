
# Interest API

The Interest API lets authenticated students browse activities,
record interests, and explore personalized stories.

Every endpoint requires a valid session. The session is resolved
through Sessioning.current to obtain the authenticated user.

The frontend cannot provide a different user identifier to
access another student's data.

## Browsing interests

An authenticated student
[retrieves the catalog topics](reaction:InterestApi.InterestBrowsing.GetTopics)
through the [catalog topics](former:InterestApi.InterestBrowsing.TopicsList).

An authenticated student
[retrieves the catalog activities](reaction:InterestApi.InterestBrowsing.GetActivities)
through the [catalog activities](former:InterestApi.InterestBrowsing.ActivitiesList).

An authenticated student
[saves or updates a preference](reaction:InterestApi.InterestBrowsing.SetPreference)
for an existing topic or activity.

The authenticated student
[retrieves their preferences](reaction:InterestApi.InterestBrowsing.GetPreferences)
through the [preferences for a user](former:InterestApi.InterestBrowsing.PreferencesList).

```endpoints
InterestApi.InterestBrowsing.GetTopics at /interests/topics
InterestApi.InterestBrowsing.GetActivities at /interests/activities
InterestApi.InterestBrowsing.SetPreference at /interests/preference
InterestApi.InterestBrowsing.GetPreferences at /interests/preferences
```

## Exploring stories

An authenticated student
[starts a story](reaction:InterestApi.StoryExploring.StartStory)
for a selected activity.

The student's profile description is retrieved from Account
on every start request and supplied as the story's personalization context.
The browser supplies only the selected activity, never an authoritative profile
description. New stories use the latest saved description, including an empty
description; existing stories continue using their original context snapshot.

When a story is generated, the existing
StoryCreatedStartsExploration reaction starts its exploration.

A student
[retrieves their story](reaction:InterestApi.StoryExploring.GetStory)
using StoryGeneration.getStory.

A student
[retrieves their list of stories](reaction:InterestApi.StoryExploring.GetStories)
using StoryGeneration.getStories.

Each story summary includes the original Activity identifier.
This allows the frontend to reopen a story without generating
a duplicate.

A student
[continues their story](reaction:InterestApi.StoryExploring.ContinueStory)
by answering its current question. Prepared prompts default to short open-ended
why questions and text answers. The chapter response retains optional choices
only for genuinely applicable future or live closed decisions; when present the
frontend presents those answers as radios. The new reader
supplies expectedChapter directly to StoryGeneration.continueStory; omission
remains supported for legacy callers. A supplied stale chapter refuses without
answering a later chapter. Acknowledge continuation only after the accepted
answer and its successor are committed under the existing persistence boundary.
After an uncertain reply, fetch the story rather than replay the old answer.

A student
[retrieves their exploration history](reaction:InterestApi.StoryExploring.GetExplorationHistory)
through the [explorations for a user](former:InterestApi.StoryExploring.ExplorationHistory).

Only stories and explorations belonging to the authenticated
student can be retrieved or changed.

### Story Experience

While reading either story format, the student's current saved display name and
description remain visible in a sticky profile panel, including while loading or
reporting an error. Long descriptions wrap and can be scrolled within the panel;
an empty description shows “No description saved yet.” Profile edits update this
panel without regenerating existing chapters.

Opening a story records only its identifier in the URL. Refresh authenticates the
session, reloads the saved profile, catalog, and story summaries, and reopens that
story only if it belongs to the authenticated student's saved list and its activity
is available. An unknown or foreign identifier returns to Activities. Returning to
Activities or signing out removes the identifier. MongoDB remains authoritative
for chapters, accepted answers, and endings; the URL contains navigation state only.

The default progressive flow uses the saved description when starting a story and
retains that snapshot for subsequent chapters. Each chapter has an introduction,
two decisions and consequences, a conclusion, and a practical challenge. Previous
chapters retain all narrative passages, questions, accepted answers, conclusions,
and challenges in expandable history. Saved narrative remains readable even when
a separate reflection read fails. Reading saved content does not call a model.

Progressive generation defaults to auto: it uses prepared content without a key
and attempts live generation with a key. Prepared mode makes no model calls.
Explicit disabled mode refuses generation, and explicit live mode requires a key.
In auto or live mode, model errors, timeouts, and unusable responses fall back to
prepared content independently for the opening, either consequence, and later
chapters. The prepared flow reuses the activity's two open-ended why questions and
answer-dependent scenes, conclusion, and household-material challenge, alongside
a planning/testing/reflection overview. Fallback preserves accepted choices and
does not reset existing chapters. Both formats acknowledge successful mutations
only after the existing persistence boundary has saved them.

```endpoints
InterestApi.StoryExploring.StartStory at /stories/start
InterestApi.StoryExploring.GetStory at /stories/get
InterestApi.StoryExploring.GetStories at /stories/list
InterestApi.StoryExploring.ContinueStory at /stories/continue
InterestApi.StoryExploring.GetExplorationHistory at /explorations/history
```

## Final-activity work

An authenticated student [reopens their activity work](reaction:InterestApi.ActivityReflecting.GetReflection).
An authenticated student [saves their activity work](reaction:InterestApi.ActivityReflecting.SaveReflection).
Both flows resolve Sessioning.current and call StoryGeneration.getActivityChapter
with that user and the requested story before any Reflecting access. Missing
and foreign stories have indistinguishable not-found behavior. An owned story
without its final activity refuses ACTIVITY_NOT_REACHED. Unknown or expired
sessions retain Sessioning's UNKNOWN_SESSION refusal. The caller cannot supply
another user or a different chapter; the returned final chapter is authoritative.
Legacy Reflecting actions and journal queries are not public endpoint bypasses.

GetReflection calls Reflecting.get with the authorized user/story/chapter and
returns its PageResult as entry, including null for unsaved work. Absence is
revealed only after authorization and activity eligibility. SaveReflection calls
Reflecting.save with that same scope and the complete submitted text/image
replacement, then Reflecting.get to return the committed entry. Reflecting owns
content validation and its stable refusal codes; input/content refusal has no effect.
A durable page-operation failure preserves previous saved page content, although an
empty ensured journal may remain if journal creation succeeded first. Journal and
page writes are not promised to be one transaction.
Neither endpoint changes ExplorationTracking.

Both answers include the [upload limits](computation:reflectionLimits).
This is a pure constant projection, not a concept-state lookup.

```computations
reflectionLimits() : ReflectionLimits
  Produces maxImages 3, maxImageBytes 1048576, maxTextCharacters 5000, acceptedMimeTypes image/jpeg, image/png, image/webp, and requestBodyBytes 5242880.
```

```endpoints
InterestApi.ActivityReflecting.GetReflection at /stories/reflection/get
InterestApi.ActivityReflecting.SaveReflection at /stories/reflection/save
```

The existing request boundary accepts bounded JSON data URLs within that body
limit and refuses oversized requests with INVALID_REQUEST before page changes.
Malformed request values refuse INVALID_REQUEST before concept effects. No
separate upload route, client-selected owner, or public image URL is introduced.

Save acknowledgement follows durable complete-page replacement and retrieval of
the resulting entry. There is no success before required persistence. A failed page replacement
preserves previous saved page content; concurrent accepted replacements use
last-writer-wins behavior without merging. The retry identity is the authorized
user/story/final-chapter tuple, checked by Reflecting.save; identical replacement
retries retain page identity and do not duplicate pages. A lost reply or failed
post-save read can leave durable work unknown to the browser. Reopening through
GetReflection recovers it; retrying the same replacement is safe when no newer
edit must be preserved. Journal creation alone carries no submitted-work meaning.
This is a server-side durable success boundary, not an exactly-once delivery
promise.

## Persistence

InterestCollection, StoryGeneration, ExplorationTracking, and Reflecting
remain independent concepts.

The application persistence adapter stores and restores
their state in MongoDB.

The state is restored before catalog initialization, preserving
existing Topic, Activity, Story, and Exploration identifiers.

The browser retrieves saved preferences and story summaries
after authentication. It does not use browser-local storage
as the authoritative source for student data.

Refresh and backend restoration preserve chapter identities, all accepted answers,
the ending or chapter conclusion, and the practical activity. Reopening reads saved
content rather than generating it again. Unsubmitted answer drafts are not saved.

## Alpha scope

For Alpha, students can browse a predefined catalog, save
interests, create and continue stories, and reopen stories
across application restarts.

Students can also save and reopen private final-activity text and uploaded photos.
Reflection persistence must be ready before serving these endpoints: initialization
never returns an empty page in place of unavailable durable work. Adapter
unavailability refuses the internal/domain REFLECTION_UNAVAILABLE until recovery.
That refusal is left unmapped in publicErrors: the existing boundary returns its
opaque INTERNAL_ERROR response and permits retry through the same endpoint. No
UNAVAILABLE category, custom response, or custom router is selected. Persisted
work is never returned as absent during unavailability. Old snapshots
without Reflecting represent no saved work; legacy pages without photos have
empty images. Preserve existing story/page identities and answers; ambiguous
legacy chapter associations are not silently reassigned. On restore, recognized
unanswered legacy prepared questions become short open-ended why questions with
choices removed, consistently with newly generated prepared content and malformed
choice fallback. Answered historical chapters retain original questions and accepted
answers. Chapter identities, story text, order, and narrative state remain unchanged.
Browser previews are
transient; saved photos and text come from the backend.

The frontend sends session cookies with requests and
does not choose the account identifier.
