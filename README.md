
# Ask Jordan

### Interactive Interest Exploration for Middle School Students

Ask Jordan is an AI-powered interactive storytelling application designed to help middle school students (ages 11–14) discover and explore new interests.

Many students limit themselves to activities they already know or those popular among their peers. Ask Jordan encourages students to explore unfamiliar possibilities through personalized stories, meaningful decisions, and small real-world challenges.

Our goal is not to assess students' abilities or recommend a single career path. Instead, we want to help them discover what they genuinely enjoy.

## F4: Alpha Checkpoint

**Status:** Functional MVP

### Deployed Application

**Public URL:** https://askjordan.mit-sdg.dev/

### Screen Recording

**Narrated demo:** To be added after recording.

### Alpha Features

The current application supports:

- **User accounts:** Registration, sign-in, and persistent profiles.
- **Interest exploration:** Browse and select activities from a predefined catalog.
- **AI-generated stories:** Personalized interactive chapters about the chosen activity.
- **Educational content:** Each chapter introduces relevant theory and key terms.
- **Interactive decisions:** Two decisions per chapter, with consequences reflected in the narrative.
- **Practical challenges:** Small activities that students can attempt outside the app.
- **Reflections:** Save text, photographs, or both after each challenge.
- **Progressive learning:** Completing a reflection unlocks another chapter.
- **Saved progress:** Reopen adventures and review completed chapters, decisions, and reflections.
- **Photo viewing:** Enlarge uploaded photographs to review work.

Existing stories using the original three-chapter format remain supported.

### Alpha User Journey

1. Register or sign in.
2. Create a profile describing interests and experiences.
3. Choose an activity to explore.
4. Read the AI-generated introduction and educational theory.
5. Make the first decision and observe its consequences.
6. Make the second decision and reach the chapter conclusion.
7. Try the suggested real-world challenge.
8. Save a reflection with text and/or photographs.
9. Continue to the next chapter or revisit previous chapters.

### Alpha Design and Documentation

- [F4: Updated Concept Design](writings/F4-updated-concept-design.md)
- [F4: Updated Development Plan](writings/F4-updated-development-plan.md)
- [Original F3: Concept Design](writings/conceptdesign.md)
- [Application Setup and Technical Documentation](askjordan/README.md)

The Alpha design introduces progressive learning chapters while preserving compatibility with the original story implementation.

The updated development plan documents our implementation progress, changes since F3, remaining work, and priorities for Beta.

## Technical Overview

Ask Jordan is built using:

- **Frontend:** Vue 3 and TypeScript
- **Backend:** Bun and TypeScript
- **Database:** MongoDB
- **AI:** OpenAI API for personalized story generation
- **Application design:** MIT Sync Engine concepts and compositions

The application includes session-based authentication, persistent story progress, and private chapter reflections.

The source code and local setup instructions are available in the [application directory](askjordan/).

## Testing

The application includes automated tests covering authentication, story generation, progressive chapter transitions, reflection persistence, access control, and compatibility with existing stories.

To run validation from the `askjordan/` directory:

```bash
bun run check
bun run check:design
bun run vue-tsc --noEmit -p web/tsconfig.json
bun test
```

The Alpha will be further evaluated through user testing and feedback before the final release.

## Development Roadmap

### F4 — Alpha (November 23, 2026)

Deliver a functional MVP demonstrating personalized interest exploration through progressive stories, decisions, challenges, and reflections.

### F5 — Beta (November 30, 2026)

Improve application reliability, AI content quality, usability, and overall completeness.

### F6 — User Testing (December 7, 2026)

Complete user testing, document observations, and identify areas for improvement.

### F7 — Final Demo and Report (December 9, 2026)

Present the completed application, demonstrate the user journey, and report on design decisions, implementation, and testing.

## Previous Submissions

- [F2: Problem Framing](writings/F2.md)
- [F3: Design Document](writings/F3.md)
- [F3: Concept Design](writings/conceptdesign.md)

## Visual Design Study

- [Colors Study 1](visualdesignstudy/colors1.jpg)
- [Colors Study 2](visualdesignstudy/colors2.jpg)
- [Typography Study](visualdesignstudy/typescripts.jpg)
- [Layouts Study](visualdesignstudy/layouts.jpg)
- [Color Research](visualdesignstudy/sourcesaboutcolors.jpg)

---

**MIT 6.1040 — Software Design, Fall 2026**

**Team:** Alisa, Sofia, Sarah, Elvis
