
# F4: Updated Concept Design — Ask Jordan

## Overview

Ask Jordan is an interactive interest-exploration application for middle school students aged 11–14. It helps students discover unfamiliar activities and explore different directions within activities they already enjoy.

Students select an activity, experience a personalized educational story, make decisions that affect the narrative, complete a small real-world challenge, and reflect on what they learned.

The Alpha implementation extends our original F3 design with a progressive learning journey. Instead of limiting every story to three chapters, students can continue learning through additional chapters, completing a reflection before advancing.

The purpose remains interest exploration, not aptitude assessment or career prediction.

## 1. Core User Journey

1. The student registers or signs in.
2. The student creates a profile containing a display name and an optional description of their interests and experiences.
3. The student browses a predefined catalog of activities and selects one to explore.
4. Ask Jordan generates the first chapter of a personalized story about that activity.
5. The chapter introduces factual educational theory relevant to the selected activity.
6. The student makes a first decision, and the story continues based on that choice.
7. The student makes a second decision, leading to a chapter conclusion.
8. The student receives a practical challenge related to the chapter's educational concept.
9. After attempting the challenge, the student saves a reflection containing text, photos, or both.
10. Saving the reflection unlocks the next chapter.
11. The student can revisit completed chapters and review previous choices, reflections, and uploaded photos.

The student may also return to the activity catalog and reopen an existing story without losing progress.

## 2. Core Concepts

### Authenticating

Authenticating verifies a user's identity using a username and password.

Passwords are not stored as plaintext.

### Sessioning

Sessioning provides an expiring session after successful authentication.

The browser sends the session cookie to identify the user during subsequent requests.

Progressive Story endpoints authenticate requests through the same session store as the existing application.

### Account

Account stores the user's profile, including a display name and an optional description.

The description provides personalization context for new stories. Changing the profile does not rewrite already generated story chapters.

Profile information is contextual input, not a source of commands for the story generator.

### InterestCollection

InterestCollection maintains the shared catalog of topics and activities, their relationships, and users' expressed preferences.

An Activity is the specific subject of exploration, such as Filmmaking or Robotics.

The selected Activity determines the educational subject of a story. Profile interests can influence its characters, setting, or examples, but should not replace the chosen Activity.

Activities retain stable IDs in application state. The AI generator receives the human-readable activity name and description.

### InterestGeneration

InterestGeneration can suggest activities using preferences, catalog relationships, and previously started activities.

Students are not limited to recommendations: they can browse and choose activities themselves.

Recommendation is not the same as judging aptitude or determining what a student is capable of doing.

### StoryGeneration

StoryGeneration continues to support the original three-chapter Legacy Story format, including existing stories and their associated API.

It also provides an internal entry point for starting Progressive Stories and checks that a student does not start duplicate stories for the same Activity across formats.

Legacy and Progressive Stories have distinct execution flows.

### ProgressiveStoryEngine

The ProgressiveStoryEngine manages the new educational journey.

A Progressive Story belongs to a user, is associated with one selected Activity, and contains an ordered sequence of chapters.

Each chapter contains:
- Its position in the story
- An educational theory topic, explanation, and key terms
- A narrative introduction
- A first decision
- A generated consequence of that decision
- A second decision
- A generated conclusion
- A practical challenge
- A stage indicating the student's progress
- An optional reference to a saved reflection

The stages are:

**first-choice**
The student reads the introduction and chooses how to respond to the first question.

**second-choice**
The first decision has been recorded. The student reads its consequence and makes a second choice.

**awaiting-reflection**
Both decisions are complete. The student sees the conclusion and practical challenge and may submit a reflection.

**reflected**
The reflection has been saved and verified. The student can advance to the next chapter.

A new chapter cannot start until the preceding chapter has reached the reflected stage.

Completed chapters remain accessible and their decisions remain part of the story's history.

The progressive generator uses the selected Activity, available profile context, previous chapters, and recorded decisions to generate new content.

### Reflecting

Reflecting stores private, chapter-specific records containing text, uploaded photos, or both.

A student may submit a reflection with up to:
- 5,000 characters of text
- Three JPEG, PNG, or WebP images
- 1 MiB per stored image

Large images can be reduced in size by the browser before upload.

Reflection content is stored in MongoDB separately from the main application state snapshot.

The Progressive Story Engine confirms that a saved reflection exists before marking a chapter reflected.

Students can reopen past completed chapters and view their saved reflections and photos.

### ExplorationTracking

ExplorationTracking records exploration state for stories.

It remains a separate concept from story generation and reflection storage.

The progressive chapter-completion mechanism does not automatically mean that an entire interest exploration has been completed.

The Alpha interface prioritizes continuous chapter progression rather than a fixed final chapter.

### AvatarCustomizing

AvatarCustomizing remains part of the application's existing concept set.

It is not required for the demonstrated Progressive Story journey in the Alpha interface.

## 3. Main Data Relationships

- One user may own multiple stories, for different Activities.
- Each user may have at most one active story record per Activity across the existing story formats.
- Each Progressive Story contains an ordered sequence of chapters.
- Each Progressive Chapter belongs to exactly one story.
- Decisions and generated narrative content belong to the chapter in which they occurred.
- A saved reflection is scoped to a user, a story, and a chapter.
- Profile information belongs to Account rather than StoryGeneration.
- The activity catalog belongs to InterestCollection, rather than the AI model.

## 4. Important Design Decisions

### A. Progressive chapters rather than a fixed three-chapter story

**Original F3 design:** Stories had a maximum of three chapters, with the practical activity appearing at the end.

**Updated Alpha design:** A story can continue through additional chapters, with a practical challenge and reflection after each chapter.

**Rationale:** Students can explore the same interest more deeply rather than ending the journey after a short introduction.

### B. Two decisions within a chapter

**Original F3 design:** Answers mainly determined the next chapter.

**Updated Alpha design:** Each chapter contains two decisions whose consequences appear within the same chapter.

**Rationale:** Students receive more immediate feedback on their choices, making the story more interactive.

### C. Educational theory before decisions

The updated design explicitly includes a theory section with real facts and vocabulary about the selected activity.

**Rationale:** A story should help students learn what an activity involves, not only entertain them.

### D. Activity-first personalization

The selected Activity is the subject of the lesson. Profile context influences presentation but must not redirect the lesson toward an unrelated interest.

**Rationale:** Students need to explore the activity they actually chose.

### E. Reflection as a progression requirement

Each chapter ends with a real-world challenge and a reflection stage.

The next chapter is unlocked only after a reflection has been saved.

**Rationale:** The app connects fictional exploration to actual experience, and encourages students to notice what they liked, struggled with, and want to explore next.

### F. Persistent learning history

Students can revisit previous chapters, answers, reflections, and photos.

**Rationale:** Exploration is a process. Preserving previous experiences supports reflection on how interests develop over time.

### G. Legacy compatibility

Existing Legacy Stories are preserved rather than converted into a potentially incompatible progressive format.

**Rationale:** Previously saved work and historical chapter identities should remain readable.

## 5. Interaction Design

The primary progressive interface consists of:

1. Activity title and chapter progress
2. Expandable previous-chapter history
3. Educational theory and key terms
4. Ongoing narrative
5. Decision input
6. Consequence of the student's choice
7. Practical challenge
8. Reflection form with optional photos
9. Chapter-completion state
10. Next-chapter action

The interface reveals the next relevant action based on the chapter's stage.

Saved reflections appear on completed chapters and in previous-chapter history.

Photos can be previewed in an enlarged view.

## 6. Ethical Considerations

### Age appropriateness

The target audience is students aged 11–14. Content should use understandable language and age-appropriate activities.

### Safety

Practical challenges should be short, affordable, and achievable with ordinary materials or a smartphone. They should not require contacting strangers or sharing identifying information.

### Privacy

User profiles, decisions, reflections, and photos must remain associated with the authenticated owner. Reflections are not public posts.

### Bias and choice

AI suggestions should not label students as talented or untalented. Students remain free to choose Activities regardless of prior interests, background, or recommendations.

### Reliability of AI content

Educational explanations should be accurate, relevant to the selected Activity, and understandable to the intended audience. Because AI output is probabilistic, quality must be evaluated through testing rather than assumed.

### Access barriers

Challenges should not depend on expensive equipment, paid classes, transportation, or access to specialist facilities.

## 7. Alpha Implementation Status

Implemented in the current Alpha:
- Account registration and sign-in
- User profiles
- Predefined Activity catalog
- Activity preferences
- Legacy Story compatibility
- Progressive AI-generated chapters
- Two interactive choices per progressive chapter
- Educational theory and practical challenges
- Text and photo reflections
- Viewing saved reflections in completed chapters
- Progress persistence and reopening
- Session-based access control
- Automated backend and TypeScript checks

## 8. Remaining Work and Limitations

The current Alpha does not establish that AI-generated educational content is consistently accurate or effective for real middle school students.

Further work includes:
- Testing story quality across different Activities and profiles
- User testing with representative participants
- Evaluating whether decisions create meaningful narrative differences
- Improving robustness under simultaneous writes or persistence failures
- Verifying public deployment and configuration
- Improving the experience based on testing findings

The design intentionally does not attempt to measure student aptitude, predict careers, or infer a student's interests from one response.

## 9. Relationship to F3

This document updates the F3 conceptual design and user journey to reflect the running Alpha.

The existing formal concept contracts continue to specify the original concepts and Legacy Story actions. The ProgressiveStoryEngine is a separately implemented learning workflow integrated with those concepts.

The difference is intentional: the Alpha preserves compatibility with previous behavior while introducing a new story format.

Future design work should reconcile the progressive workflow into formal specifications and implementation checks without changing existing action contracts without corresponding code and tests.
