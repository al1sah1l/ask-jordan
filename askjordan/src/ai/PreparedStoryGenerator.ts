import type { GeneratedStoryChapter, StoryChapterContext, StoryGenerator } from "./StoryGenerator.ts";

type Adventure = {
  opening: string;
  question1: string;
  firstKeywords: RegExp;
  first: [string, string];
  question2: string;
  secondKeywords: RegExp;
  second: [string, string];
  ending: string;
  task: string;
};

const adventures: Record<string, Adventure> = {
  "Sports Photography": {
    opening: 'Alex kneels beside a practice soccer pitch, safely behind the sideline.\n\nJordan holds up a cardboard frame. “A photo can tell a story before anyone reads the score.”\n\nA player races for a loose ball while the bench leans forward. Alex has time to frame just one moment.',
    question1: "What would you photograph first, and why?",
    firstKeywords: /crowd|bench|fan|react|audience/i,
    first: ['Alex turns toward the bench. A substitute leaps up as the ball reaches the goal, and the picture catches three different expressions. Jordan notices that the excitement is visible even without the ball.', 'Alex follows a player from behind the sideline, keeping the camera steady as the ball rolls into view. The resulting picture catches one shoe lifted above the grass. Jordan points out how that small detail suggests speed.'],
    question2: "Why would you use a close-up or a wide shot?",
    secondKeywords: /close|detail|shoe|hand|face/i,
    second: ['Alex frames a close detail: muddy shoes beside a bright white line. Suddenly the practice feels like a real place instead of a distant game.', 'Alex steps back within the safe viewing area and frames the whole pitch. The players, bench, and goal now explain how the earlier moment fits together.'],
    ending: 'Jordan lays the two pictures side by side. Alex gives them the title “One Practice, Two Stories.” The team can remember both the movement and the feeling of being there.',
    task: 'Try this for 10 minutes: use a phone camera, or draw three photo frames on paper. In a clear space, roll a soft sock ball across a table. Make one wide picture, one close detail, and one picture showing movement. Stay still while taking pictures and compare which tells the clearest story.',
  },
  "Sports Commentary": {
    opening: 'A sock ball rolls toward a cardboard goal on Alex’s kitchen table.\n\nJordan taps a spoon against an empty mug like an opening bell. Their miniature match needs a commentator.\n\nAlex takes a pencil for a pretend microphone just as the ball stops a finger’s width from the goal.',
    question1: "What would you tell the audience first, and why?",
    firstKeywords: /strateg|explain|why|plan|tactic/i,
    first: ['Alex slows down and explains the choice to aim along the table’s edge. Jordan can picture the plan before the next roll begins. The pause gives the tiny match real suspense.', 'Alex calls the roll in short bursts: “Across the table—off the book—almost in!” Jordan follows every change in direction without looking at the ball.'],
    question2: "Why would you choose an energetic or calm finish?",
    secondKeywords: /calm|quiet|detail|slow/i,
    second: ['Alex leaves a breath between each observation and describes the ball resting against the goalpost. The quiet makes the final roll feel enormous.', 'Alex lifts their voice for the final roll, then pauses before announcing the goal. Jordan cheers into the spoon microphone.'],
    ending: 'They replay the match with their eyes closed, listening to Alex’s words. Jordan can explain exactly what happened. Alex realizes a good commentator helps someone else see the moment.',
    task: 'Spend 5–10 minutes making a sock-ball tabletop match with two books as goalposts. Roll gently while seated. Write three commentary lines: the setup, the action, and the result. Read them aloud once with excitement and once calmly; notice what changes. Recording is optional.',
  },
  Filmmaking: {
    opening: 'Alex places a paper star beside an empty mug. In their film, the star has vanished from the night sky.\n\nJordan slides a phone onto a stable pile of books. “We have a table, two props, and a mystery.”\n\nAlex moves the mug, revealing a trail of tiny paper footprints.',
    question1: "What would you reveal to the audience first, and why?",
    firstKeywords: /footprint|follow|mystery|hide|trail/i,
    first: ['Alex films the paper footprints one at a time. Jordan moves the mug between shots, keeping hands out of the frame. When the star finally peeks out, the trail has earned its surprise.', 'Alex opens with the star tucked under the mug. Now the audience knows the secret while the paper detective searches. Jordan laughs as the detective walks right past it.'],
    question2: "Why would you choose that ending shot?",
    secondKeywords: /close|detail|zoom/i,
    second: ['Alex brings the camera close to the star resting in the detective’s paper hand. One small image makes the discovery clear.', 'Alex uses a wide shot showing the footprints, mug, and recovered star. The audience can retrace the whole mystery.'],
    ending: 'Jordan watches the three shots in order. Without any dialogue, the star disappears, gets discovered, and returns to a paper sky. Alex writes “The Tabletop Mystery” on a title card.',
    task: 'Take 10–15 minutes to make a three-shot tabletop story using paper, a pencil, and a mug. Draw a beginning, a discovery, and an ending on three cards, or film three short clips with a phone resting securely on a table. Use only your props; keep people and private details out of the frame.',
  },
  "Creative Writing": {
    opening: 'Alex opens a library book and finds a folded map drawn on its blank bookmark. Every street has a name except one.\n\nJordan, the library’s visiting story guide, places a pencil beside it. “Someone left a road for us to invent.”\n\nA tiny drawn door appears at the road’s end.',
    question1: "What would Alex do next, and why?",
    firstKeywords: /map|study|read|inspect|look/i,
    first: ['Alex studies the map and notices that every named street describes a sound. They name the missing road “Whisper Lane,” and the tiny door swings open at the whispered words.', 'Alex opens the tiny door and finds a room full of unfinished sentences. One sentence slips onto the bookmark, giving the mystery a voice.'],
    question2: "Why would your idea help Alex solve the mystery?",
    secondKeywords: /friend|help|character|person|together/i,
    second: ['Alex invites a small ink-drawn librarian to help. Together they match the loose sentence to the missing road, giving each other clues neither could see alone.', 'Alex folds the bookmark so the door meets the missing road. The two drawings join, and the unfinished sentence finally has a destination.'],
    ending: 'Jordan reads Alex’s new last line aloud: the map leads back to the open book, ready for another reader. Alex adds a title and leaves the bookmark safely inside. A mystery that began with an empty space now has an ending.',
    task: 'Spend 10 minutes with paper and a pencil. Draw a door, choose an ordinary object behind it, and write six sentences: two to introduce a character, two showing a problem, and two resolving it. Add one sound and one line of dialogue. Give your tiny story a title.',
  },
  "Game Design": {
    opening: 'Alex arranges six paper islands across the table. A button traveler must reach the last island, but on the first attempt it wins without making a single interesting choice.\n\nJordan turns over a scrap labeled “storm.”\n\n“We can change a rule, then test what happens.”',
    question1: "What rule would you add, and why?",
    firstKeywords: /help|resource|tool|bridge|safe/i,
    first: ['Alex adds a bridge token that can be used once. Jordan saves it until a storm blocks the next island. Deciding when to spend it makes the easy route surprisingly tense.', 'Alex adds a shortcut that skips two islands but costs a turn when a coin lands tails. Jordan takes the risk and lands safely, then wants to test the other result too.'],
    question2: "Why would your change make the game more interesting?",
    secondKeywords: /easy|easier|fair|help|simple/i,
    second: ['Alex gives the traveler one retry. Jordan reaches the goal after a mistake, and the game feels welcoming without losing its choices.', 'Alex adds one storm island near the finish. Jordan has to plan ahead instead of saving every choice until the final move.'],
    ending: 'They play twice more and write down where each rule matters. Jordan circles one moment when both routes were tempting. Alex names the game “Six Islands” and keeps the rules that created that decision.',
    task: 'Take 10–15 minutes with six paper squares, a button, and a coin. Lay out an island path. Heads moves one step; tails lets you choose to wait or try a shortcut. Define one shortcut cost before playing. Play twice, change one rule, and compare how many turns each version takes.',
  },
  Robotics: {
    opening: 'Alex builds a pretend delivery robot from a cereal box. It has no motor; Jordan will be its feet and follow only written commands.\n\nThe robot must carry a folded paper message across a clear tabletop route.\n\nAlex writes “Go to the goal,” but Jordan waits. The command needs smaller steps.',
    question1: "How would you plan the route, and why?",
    firstKeywords: /test|small|one|step|try/i,
    first: ['Alex tests “move one square” on a paper grid. Jordan moves the box exactly one square, and Alex spots that the next turn needs its own command. Testing early catches a wrong direction.', 'Alex draws the entire route with arrows before writing commands. Jordan follows them until the box faces the wrong way. The map makes it easy to locate the missing turn.'],
    question2: "Why would your fix help the robot reach its goal?",
    secondKeywords: /check|sensor|each|stop|look/i,
    second: ['Alex adds “check the next square is clear” before each move. When a pencil blocks the route, Jordan stops the box instead of pushing through.', 'Alex changes the turn arrow, then tests the whole route again. The box rounds the pencil safely and reaches the paper goal.'],
    ending: 'The message arrives intact. Jordan points to Alex’s crossed-out commands: each correction made the instructions more precise. The cardboard robot cannot think for itself, but Alex has learned how to give it a reliable plan.',
    task: 'Spend 10 minutes drawing a 4-by-4 grid on paper. Use an empty box or folded paper as a pretend robot. Mark a start, goal, and blocked square. Write forward and turn commands, then move the robot by hand to test them. Fix one error. No electronics, tools, or batteries are needed.',
  },
  "Music Production": {
    opening: 'Rain ticks against Alex’s window while a spoon rests beside an empty plastic cup.\n\nJordan taps the table four times. “There’s a track hiding in this room.”\n\nAlex hears a steady pulse under the uneven raindrops and starts building a rhythm without turning the volume up.',
    question1: "What sound would you start with, and why?",
    firstKeywords: /unusual|rain|sound|cup|spoon|weird/i,
    first: ['Alex gently taps the plastic cup and leaves a gap after each hollow note. Jordan supplies a quiet table beat underneath. The unusual sound becomes a repeating hook.', 'Alex starts with four even fingertip taps. Jordan adds one soft cup tap after the fourth beat, creating a pattern that is easy to follow.'],
    question2: "Why would you add another sound or leave a pause?",
    secondKeywords: /silence|silent|gap|pause|space|quiet/i,
    second: ['Alex leaves one whole beat silent. When the pattern returns, Jordan grins: the missing sound made everyone listen more closely.', 'Alex adds a gentle hand clap on the last beat. It contrasts with the soft taps and makes the ending easy to recognize.'],
    ending: 'They repeat the pattern three times, ending together on a single tap. Jordan calls the track “Window Weather.” Alex writes down the rhythm so it can be played again tomorrow, even if the rain stops.',
    task: 'Try 5–10 minutes of quiet rhythm making with your hands, a table, and an empty plastic cup. Count four beats, make a repeating pattern, then add either one new sound or one silent beat. Play it three times with an ending. Keep sounds comfortable; phone recording is optional.',
  },
  "Sports Analytics": {
    opening: 'Alex watches two paper score sheets from a sock-ball target game. One player scored more total points, but the other made fewer attempts.\n\nJordan places a pencil between the sheets. “The totals tell one story. Let’s find out what they leave out.”\n\nAlex draws a column for attempts.',
    question1: "What would you compare, and why?",
    firstKeywords: /attempt|rate|percent|ratio|accuracy|out of/i,
    first: ['Alex divides successful throws by all attempts. The player with fewer total points now has the higher success rate. Jordan labels both columns so neither result gets mistaken for the whole story.', 'Alex compares total points and marks the leading player. Jordan asks Alex to add attempts beside the totals. Suddenly a big score can also mean more chances to play.'],
    question2: "Why would more data or a chart help explain the result?",
    secondKeywords: /round|more|gather|again|new|test/i,
    second: ['Alex records another equal round for both players. The results shift slightly, showing why one short game cannot predict every future score.', 'Alex draws bars for both successes and attempts. Jordan can immediately see which player had more chances and which used them more often.'],
    ending: 'Alex writes a careful caption instead of declaring a permanent winner. Jordan pins the chart beside the rules so anyone can understand what was measured. The numbers have become a useful question for the next game.',
    task: 'Spend 10 minutes with paper, a pencil, a soft sock ball, and a bowl on a table. While seated, make two rounds of five gentle tosses from the same spot. Tally successes and attempts, draw two bars, and write one sentence comparing the rounds. Keep the space clear and avoid breakable objects.',
  },
};

function quote(value: string): string {
  return `“${value.replace(/\s+/g, " ").trim().slice(0, 240)}”`;
}

/** Prepared scenes treat profile and answers as bounded quoted data, never instructions. */
export class PreparedStoryGenerator implements StoryGenerator {
  async generateChapter(input: StoryChapterContext): Promise<GeneratedStoryChapter> {
    const name = input.activity.split(/\s+[—–]\s+|\s+-\s+/)[0]!.trim();
    const adventure = adventures[name] ?? {
      opening: `Alex finds a blank project card labeled ${quote(name || "a new activity")}. Jordan places paper and a pencil on the table. Together they choose one small thing to investigate rather than trying to learn everything at once.`,
      question1: "How would you start exploring this activity, and why?",
      firstKeywords: /observ|look|watch|example/i,
      first: ['Alex studies an example and sketches three details. Jordan helps turn the most surprising detail into a small experiment.', 'Alex makes a rough paper prototype. Jordan tries it and points to one part that is easy to understand and one that needs another attempt.'] as [string, string],
      question2: "Why would you change that part of your idea?",
      secondKeywords: /simple|simpl|less|remove/i,
      second: ['Alex removes an extra step. Jordan can now follow the idea from beginning to end without getting stuck.', 'Alex adds one labeled detail. Jordan spots its purpose immediately and helps test the revised version.'] as [string, string],
      ending: 'Alex places the first sketch beside the revised one. Jordan circles the change that helped most. The project card now holds a real experiment and a next step.',
      task: 'Spend 10 minutes with paper and a pencil. Choose one safe aspect of this activity, sketch a tiny example, label three parts, and change one part. Compare the two versions and write what you noticed. Use drawing only if the real activity needs equipment or supervision.',
    };
    const firstAnswer = input.previousChapters.find((c) => c.position === 1)?.answer ?? "";
    const secondAnswer = input.previousChapters.find((c) => c.position === 2)?.answer ?? "";
    const firstScene = adventure.first[adventure.firstKeywords.test(firstAnswer) ? 0 : 1];
    if (input.position === 1) {
      const context = input.context.trim() ? `\n\nAlex brings a note from your saved profile: ${quote(input.context)}` : "";
      return { text: adventure.opening + context, question: adventure.question1 };
    }
    if (input.position === 2) {
      return { text: `Jordan reads your choice: ${quote(firstAnswer)}\n\n${firstScene}`, question: adventure.question2 };
    }
    return {
      text: `Jordan reads your next choice: ${quote(secondAnswer)}\n\n${adventure.second[adventure.secondKeywords.test(secondAnswer) ? 0 : 1]}\n\n${adventure.ending}`,
      suggestedActivity: adventure.task,
    };
  }
}

/** Exact recognized historical prepared prompts; answered chapters are never rewritten. */
export const legacyPreparedQuestions: Readonly<Record<string, string>> = {
  "Would you focus on a player moving or the crowd reacting? Tell Jordan what you want the picture to show.": "What would you photograph first, and why?",
  "Photograph the player or the crowd?": "What would you photograph first, and why?",
  "For your next picture, would you show a close detail or the whole scene? What detail matters?": "Why would you use a close-up or a wide shot?",
  "A close-up or the whole scene?": "Why would you use a close-up or a wide shot?",
  "Would your commentary spotlight the action or explain the player's strategy? What would you say?": "What would you tell the audience first, and why?",
  "Focus on the action or explain the strategy?": "What would you tell the audience first, and why?",
  "Would you make the ending energetic or calm and detailed? Give Jordan an example line.": "Why would you choose an energetic or calm finish?",
  "An energetic finish or a calm one?": "Why would you choose an energetic or calm finish?",
  "Would you reveal the missing star straight away or follow the footprints first? What should the audience notice?": "What would you reveal to the audience first, and why?",
  "Reveal the star or follow the footprints?": "What would you reveal to the audience first, and why?",
  "Should the last shot be a close-up or a wide view? Describe your ending shot.": "Why would you choose that ending shot?",
  "End with a close-up or a wide shot?": "Why would you choose that ending shot?",
  "Would Alex open the tiny door or study the map first? What do you imagine finding?": "What would Alex do next, and why?",
  "Open the door or study the map?": "What would Alex do next, and why?",
  "Should Alex solve the mystery with a clever idea or a helpful character? Describe what happens.": "Why would your idea help Alex solve the mystery?",
  "Solve it with a clever idea or a helpful character?": "Why would your idea help Alex solve the mystery?",
  "Would you add a risky shortcut or a helpful resource? Describe your new rule.": "What rule would you add, and why?",
  "Add a risky shortcut or a helpful resource?": "What rule would you add, and why?",
  "Should the next test make the game easier or more challenging? What rule would you change?": "Why would your change make the game more interesting?",
  "Make the game easier or harder?": "Why would your change make the game more interesting?",
  "Would you plan the whole route first or test one small movement at a time? Describe your approach.": "How would you plan the route, and why?",
  "Plan the route or test one step at a time?": "How would you plan the route, and why?",
  "Would you fix the route by changing a turn or adding a check after each move? Explain your choice.": "Why would your fix help the robot reach its goal?",
  "Change a turn or check after each move?": "Why would your fix help the robot reach its goal?",
  "Would your track start with a steady beat or an unusual sound? Describe the sound you want.": "What sound would you start with, and why?",
  "Start with a steady beat or an unusual sound?": "What sound would you start with, and why?",
  "Would you add another sound or leave a silent gap before the ending? Describe the effect.": "Why would you add another sound or leave a pause?",
  "Add another sound or a silent beat?": "Why would you add another sound or leave a pause?",
  "Would you compare total points or successful attempts out of all attempts? Explain what you want to learn.": "What would you compare, and why?",
  "Compare total points or the success rate?": "What would you compare, and why?",
  "Would you gather another round of data or draw a chart of what you have? What would it show?": "Why would more data or a chart help explain the result?",
  "Play another round or draw a chart?": "Why would more data or a chart help explain the result?",
  "Would you begin by observing an example or making a tiny prototype? Describe your idea.": "How would you start exploring this activity, and why?",
  "Study an example or make a small prototype?": "How would you start exploring this activity, and why?",
  "Would you simplify your idea or add one new detail? Explain what you would change.": "Why would you change that part of your idea?",
  "Simplify your idea or add a detail?": "Why would you change that part of your idea?"
};
