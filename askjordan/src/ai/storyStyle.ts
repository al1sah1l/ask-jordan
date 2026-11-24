export const STORY_PASSAGE_STYLE = `
READABILITY AND LENGTH:
- Each narrative passage must contain 100-150 words total. Aim for 120 words.
- This limit applies separately to an introduction, a consequence scene, or a conclusion, not to the whole chapter.
- Use 3-5 short paragraphs with 1-2 sentences each. Separate paragraphs with a blank line (\\n\\n in JSON strings).
- Put each spoken turn in its own paragraph. Separate dialogue from narration and start a new paragraph whenever the speaker changes.
- Use short, concrete sentences and familiar words. Make the action and the next decision easy to skim.
- Focus on one clear event and its consequence. Cut repeated explanations, recaps, filler, and generic encouragement.
- Return plain text inside JSON fields: no Markdown headings, bold markers, or code fences. The app supplies section headings.
- Keep questions to one short sentence and choices to a few words each.
- Keep the learning overview to 1-2 short sentences and no more than 40 words, with 2-3 useful key terms. Do not repeat a general definition of the activity.
- Keep the practical challenge to 3 short, numbered steps and no more than 60 words total.
`.trim();
