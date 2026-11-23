# Concept Design

Account stores the user's profile, while InterestCollection maintains topics, activities, their connections, and the user's expressed preferences. InterestGeneration suggests activities using those preferences without storing another copy of them. StoryGeneration manages stories and chapters for selected activities, while ExplorationTracking records which stories the user has started or completed. Reflecting stores the user's responses to individual chapters. The interest map is a frontend visualization of these concepts rather than a separate concept.

# Concepts

## Authenticating

**concept** Authenticating

**purpose** Establish a username from a password, so an identity claim alone cannot act as proof of identity.

**principle** a user registers their username with a password. Another registration with the same username is then refused. Authenticating the username with the wrong password is refused, and the correct password authenticates, returning the user's account, bound to that username

**state**

a set of Accounts, each containing:

- a unique username String
- a passwordVerifier String

**actions**

register (username: String, password: String): (account: Account)

> **where** the username is 3 to 32 letters, digits, underscores, or hyphens, the password is 8 to 128 characters, and the username is not already registered

> **then** add a new account with that username and a salted verifier derived from the password, and return the account

authenticate (username: String, password: String): (account: Account)

> **where** an account exists for the username and the password matches its verifier

> **then** return that account

**note**

A later request does not include a user id. It includes a session, and `current` is what turns that session back into the account this concept returned.

## Sessioning

**concept** Sessioning [User]

**purpose** keep a short-lived session for a user, so temporary access can end without changing that user's identity

**principle** A session is started for a user. Until it expires, current resolves the session to that user. Ending the session makes it unknown, so another current call is refused. An invented or expired session is refused in the same way

**state**

a set of Sessions, each containing:

- a user User
- an expiresAt DateTime

**actions**

start (user: User): (session: Session, expiresAt: DateTime)

> **then** delete every expired session, add a new session for that user expiring 24 hours from now, and return the session and when it expires

current (session: Session): (user: User)

> **where** the session is known and has not expired

> **then** return the user the session was started for

end (session: Session)

> **where** the session is known and has not expired

> **then** delete the session

**note**

The user on a session is the account Authenticating just returned. After sign-in, other actions recover that user by calling `current` on the session.

## Account

**concept** Account [User]

**purpose** allow users to describe themselves so that stories can reflect their background without requiring them to enter the same information repeatedly.

**principle** a user creates a profile with a display name and optional description. They can retrieve and update that information later. Interests are managed separately by InterestCollection.

**state**

a set of Profiles, each containing:
- a unique owner User
- a name String
- an about String

**actions**

createAccount (user: User, name: String, about: String): (profile: Profile)

> **where** user does not yet have a profile and name is not blank

> **then** create a Profile belonging to user with the given name and about, and return it

updateProfile (user: User, name: String, about: String)

> **where** user has a profile and name is not blank

> **then** replace the profile's name and about with the supplied values

getProfile (user: User): (profile: Profile, name: String, about: String)

> **where** user has a profile

> **then** return the user's Profile, name, and about without changing them

**note**

Account does not store initial interests. During onboarding, the user selects topics or activities, which are saved through InterestCollection.setPreference. The profile can display those preferences by reading InterestCollection separately.

## InterestCollection

**concept** InterestCollection [User, Topic, Activity]

**purpose** organize broad topics, specific activities, connections between them, and users' expressed preferences so they can discover directions they might enjoy exploring.

**principle** topics represent broad areas such as Music, while activities represent specific directions such as Songwriting. Activities can connect to more than one topic and to other activities. Users explicitly record whether they are interested, curious, or not interested in a topic or activity, and may change those preferences later.

**state**

a set of Topics, each containing:
- a unique name String
- a description String

a set of Activities, each containing:
- a unique name String
- a description String

a set of Connections, each connecting either:
- a Topic and an Activity, or
- two different Activities

a set of Preferences, each containing:
- an owner User
- a subject Subject (a Topic or an Activity)
- a status Status (interested, curious, or notInterested)

Each user has at most one Preference per subject. Connections are undirected and cannot be duplicated.

**actions**

registerTopic (name: String, description: String): (topic: Topic)

> **where** name is not blank and no Topic with that name exists

> **then** create the Topic and return it

registerActivity (name: String, description: String, topics: set Topic): (activity: Activity)

> **where** name is not blank, no Activity with that name exists, topics is not empty, and all supplied Topics exist

> **then** create the Activity, connect it to every supplied Topic, and return it

connectActivities (activity1: Activity, activity2: Activity): (connection: Connection)

> **where** both Activities exist, they are different, and no connection between them exists

> **then** create an undirected Connection and return it

setPreference (user: User, subject: Subject, status: Status): (preference: Preference)

> **where** subject exists and status is interested, curious, or notInterested

> **then** create or update the user's Preference for that subject and return it

getPreferences (user: User): (preferences: set Preference)

> **then** return the user's Preferences, or an empty set if none exist

getTopics (): (topics: set Topic)

> **then** return all registered Topics

getActivities (): (activities: set Activity)

> **then** return all registered Activities

getConnections (): (connections: set Connection)

> **then** return all registered Connections

getRelated (subject: Subject): (related: set Subject)

> **where** subject exists

> **then** return all subjects directly connected to subject

**note**

InterestCollection stores both the shared catalog and each user's explicitly expressed preferences, but does not store stories or whether an activity has been explored. A completed story does not automatically make an activity interesting. For Alpha, trusted application setup registers a small predefined catalog; users cannot register arbitrary catalog entries through the ordinary UI. The graph describes relationships, not prerequisites: unconnected activities remain selectable.

## InterestGeneration

**concept** InterestGeneration [User, Activity, Topic]

**purpose** suggest concrete activities that users may want to explore, including directions related to their interests and unfamiliar alternatives.

**principle** when suggestions are requested, the concept considers the user's preferences and the available catalog and connections. It keeps track of suggestions the user dismisses, but does not maintain a second copy of their preferences. Choosing an activity for a story does not automatically mark it as interesting.

**state**
a set of Suggestions, each containing:
- an owner User
- an Activity
- a status (pending or dismissed)

Each user has at most one Suggestion per Activity.

**actions**

generateSuggestions (user: User, preferences: set Preference, activities: set Activity, connections: set Connection, startedActivities: set Activity): (suggestions: set Suggestion)

> **where** activities is not empty

> **then** generate suggestions using the supplied preferences, activities, and connections. Exclude previously dismissed Activities and Activities in startedActivities. Replace the user's pending Suggestions with the new set and return them.

getSuggestions (user: User): (suggestions: set Suggestion)

> **then** return all pending Suggestions belonging to user, or an empty set if none exist

dismissSuggestion (user: User, activity: Activity): (suggestion: Suggestion)

> **where** user has a pending Suggestion for activity

> **then** change its status to dismissed and return it

**note**

Preferences are owned by InterestCollection and provided to generateSuggestions when needed. Dismissing a suggestion only changes suggestion state: it does not mean the user dislikes the activity. Users may still browse and select dismissed or unconnected activities. In Alpha, suggestions can be drawn from a small predefined catalog without an LLM. Beta may use an LLM to rank or explain existing catalog activities, without needing to generate new Activity entities.

## StoryGeneration

**concept** StoryGeneration [User, Activity]

**purpose** help users explore a specific activity through a personalized, short narrative with questions and a concrete activity to try.

**principle** when a user chooses an activity, they receive the first chapter of a story about it. Their response to a chapter's question shapes the next chapter. The third chapter concludes the story and suggests a small real-world activity. A user can have at most one Story for an Activity in the MVP.

**state**

a set of Stories, each containing:
- an owner User
- an Activity
- a context String containing personalization information
- an ordered sequence of Chapters

a set of Chapters, each containing:
- a story Story
- a position Integer
- a text String
- an optional question String
- an optional answer String
- an optional suggestedActivity String

Each Story contains between one and three Chapters. Each user has at most one Story per Activity.

**actions**

generateStory (user: User, activity: Activity, context: String): (story: Story, chapter: Chapter)

> **where** the user does not already have a Story for activity

> **then** create a Story for the selected Activity, using context to personalize its first Chapter. Give the first Chapter position 1, text, and a question, with no answer or suggestedActivity. Return the Story and Chapter

continueStory (user: User, story: Story, answer: String): (chapter: Chapter)

> **where** story belongs to user, answer is not blank, the latest Chapter has an unanswered question, and the Story has fewer than three Chapters

> **then** record answer on the latest Chapter and generate the next Chapter using the Activity, context, earlier Chapters, and answers. Chapter 2 has a question; Chapter 3 concludes the Story and names a small suggestedActivity but has no question. Return the new Chapter

getStory (user: User, story: Story): (chapters: sequence Chapter)

> **where** story belongs to user

> **then** return all Chapters in order, with their text, questions, answers, and suggested activities

getStories (user: User): (stories: set Story)

> **then** return the user's Stories, including their associated Activities, or an empty set if none exist

**note**

A Story explores an Activity, not a broad Topic. The context is supplied from Account.about and is not another stored profile. The suggestedActivity in the final Chapter is a small real-world task and must not be confused with the selected Activity entity. Alpha may return prepared Story content instead of calling an LLM; the same actions and chapter structure are used. One Story per Activity is an MVP limitation, not a general rule about exploration.

## AvatarCustomizing

**concept** AvatarCustomizing [User, Item]

**purpose** allow a user to customize their avatar by equipping only items that have been granted to them

**principle** when an item is granted to a user, they can equip it in a slot and later retrieve what they are wearing. Only one item can be equipped in a slot at a time. Equipping another item in the same slot replaces the item already there. An item that has not been granted cannot be equipped

**state**

a set of Holdings, each containing:

- a user User
- an item Item

a set of Worn, each containing:

- a user User
- a slot Slot
- an item Item

A slot is HEAD or BODY. A user holds a given item at most once, wears at most one item in a slot, and wears only an item they hold.

**actions**

grant (user: User, item: Item)

> **where** the user does not already hold the item

> **then** record that the user holds the item

equip (user: User, item: Item, slot: Slot)

> **where** the user holds the item

> **then** make that item the one worn in the slot, replacing whatever item was already worn there

clear (user: User, slot: Slot)

> **where** the user is wearing an item in the slot

> **then** remove it from that slot. The user still holds the item

getEquipped (user: User): (worn: set Worn)

> **where** the user has any holdings

> **then** return the items the user is wearing and the slot of each, without changing them. A user wearing nothing returns an empty set

**note**

`grant` has no caller. The user can only equip an item they already hold, so until some other action grants one, there is nothing to put on the avatar.

## ExplorationTracking

**concept** ExplorationTracking [User, Story]

**purpose** keep a record of stories users have started and completed so they can resume and review their previous explorations.

**principle** creating a Story starts one Exploration. The Exploration remains started until the user explicitly marks that Story completed after reaching its final Chapter. Saving a reflection or finishing an individual Chapter does not complete the Exploration.

**state**

a set of Explorations, each containing:
- an owner User
- a Story
- a status (started or completed)

Each User has at most one Exploration per Story.

**actions**

startExploration (user: User, story: Story): (exploration: Exploration)

> **where** the user does not already have an Exploration for story

> **then** create an Exploration for that Story with status started and return it

completeExploration (user: User, story: Story): (exploration: Exploration)

> **where** the user has an Exploration for story with status started

> **then** change its status to completed and return it

getExploration (user: User, story: Story): (exploration: Exploration)

> **where** the user has an Exploration for story

> **then** return that Exploration and its current status

getExplorationHistory (user: User): (explorations: set Exploration)

> **then** return all of the user's Explorations, or an empty set if none exist

getCompletedExplorations (user: User): (explorations: set Exploration)

> **then** return all completed Explorations for the user, or an empty set if none exist

**note**

ExplorationTracking tracks Stories only; it does not store the corresponding Activity or a user's opinion about it. StoryGeneration associates each Story with an Activity, and InterestCollection stores preferences. A completed Story is not evidence that the user tried the real-world task in the last Chapter. The Interest Map is a frontend view combining catalog, preferences, and Story completion status, not a separate concept.

## Reflecting

**concept** Reflecting [User, Story, Chapter]

**purpose** provide users with a space to reflect on their thoughts and opinions after each chapter of a story; prevents users from losing their reflections and allows them to revisit how their thoughts developed throughout an exploration.

**principle** after reading a chapter, a user can record their thoughts about the experience. Each reflection is associated with a specific chapter, allowing users to reflect multiple times while exploring the same interest. Reflections can later be retrieved or edited.

**state**

a set of Journals with an owner User, and set of Pages

a Page containing a Story, Chapter, and text String

each Journal contains at most one Page per Chapter

**actions**

createJournal (user: User): (journal: Journal)

> **where** user does not yet have a journal

> **then** create an empty Journal for user

write (user: User, story: Story, chapter: Chapter, text: String): (page: Page)

> **where** user has a journal and there is no page associated with chapter in their journal

> **then** add a new Page containing story, chapter, and text to the user's Journal, and return the new page

edit (user: User, story: Story, chapter: Chapter, text: String): (page: Page)

> **where** user has a journal and there is a page in their journal with chapter

> **then** update the text of the page and return the edited page

read (user: User, story: Story): (page: Page)

> **where** user has a journal and there is a page in their journal associated with storys

> **then** return the page associated with story

getJournal (user: User): (pages: set Page)

> **where** user has a journal

> **then** return all pages belonging to the user's journal

**note**

A journal holds at most one page per chapter, and the page is the user's writing about that chapter. Saving the page does not mark the story or the exploration complete.

# Reactions

### Account created → Create reflection journal

```
when Account.createAccount (user, name, about): (profile)
then Reflecting.createJournal (user)
```

The journal is created when the user's profile is created. Initial interests are managed separately through InterestCollection.

### Initial interest selected → Save preference

```
when Requesting.selectInitialInterest (session, subject)
where Sessioning.current (session): (user)
then InterestCollection.setPreference (user, subject, interested)
```

During onboarding, users select registered Topics or Activities. Their preferences are stored in InterestCollection rather than Account.

### Onboarding completed → Generate suggestions

```
when Requesting.finishOnboarding (session)
where Sessioning.current (session): (user)
where InterestCollection.getPreferences (user): (preferences)
where InterestCollection.getActivities (): (activities)
where InterestCollection.getConnections (): (connections)
where StoryGeneration.getStories (user): (stories)
where startedActivities are the Activities associated with stories
where activities is not empty
then InterestGeneration.generateSuggestions (user, preferences, activities, connections, startedActivities)
```

Suggestions are generated using the user's preferences, available activities, and connections. Activities for which the user has already started a Story are excluded. Users may still receive suggestions if they selected no initial interests.

### Suggestion dismissed → Record dismissal

```
when Requesting.dismissSuggestion (session, activity)
where Sessioning.current (session): (user)
then InterestGeneration.dismissSuggestion (user, activity)
```

Dismissing a suggestion does not change the user's preferences. The activity remains available through the catalog.

### Activity selected → Generate story

```
when Requesting.selectActivity (session, activity)
where Sessioning.current (session): (user)
where Account.getProfile (user): (profile, name, about)
where InterestCollection.getActivities (): (activities)
where activity is in activities
then StoryGeneration.generateStory (user, activity, about)
```

The user can select any registered Activity, including one that was not recommended. StoryGeneration enforces the MVP restriction of one Story per user and Activity. If a Story already exists, the UI should open it instead of generating another.

### Story generated → Start exploration

```
when StoryGeneration.generateStory (user, activity, context): (story, chapter)
then ExplorationTracking.startExploration (user, story)
```

An Exploration is created when the Story starts. Each Exploration tracks the entire Story rather than individual Chapters.

### Reflection submitted → Save reflection

```
when Requesting.submitReflection (session, story, chapter, text)
where Sessioning.current (session): (user)
where StoryGeneration.getStory (user, story): (chapters)
where chapter is in chapters
where chapter.question is empty or text is not blank
then Reflecting.write (user, story, chapter, text)
```

Responses to Chapters with questions must not be blank. The final Chapter may have an empty reflection because it does not require an answer to continue the Story.

### Reflection saved → Generate next chapter

```
when Reflecting.write (user, story, chapter, text): (page)
where StoryGeneration.getStory (user, story): (chapters)
where chapter is the latest chapter in chapters
where chapter.question is not empty
where text is not blank
where size(chapters) < 3
then StoryGeneration.continueStory (user, story, text)
```

The saved reflection is used as the answer to the Chapter's question, shaping the next Chapter. The final Chapter does not trigger further generation. Editing an existing reflection does not regenerate previous Chapters.

### Story marked complete → Complete exploration

```
when Requesting.completeStory (session, story)
where Sessioning.current (session): (user)
where StoryGeneration.getStory (user, story): (chapters)
where size(chapters) = 3
then ExplorationTracking.completeExploration (user, story)
```

The user explicitly marks the Story completed after reaching the final Chapter. Completing individual Chapters or saving reflections does not automatically complete the Exploration.

### Interest preference updated → Save preference

```
when Requesting.setInterestPreference (session, subject, status)
where Sessioning.current (session): (user)
then InterestCollection.setPreference (user, subject, status)
```

Users may mark a Topic or Activity as interested, curious, or notInterested. Story completion does not automatically change their preferences.

### New suggestions requested → Refresh suggestions

```
when Requesting.refreshSuggestions (session)
where Sessioning.current (session): (user)
where InterestCollection.getPreferences (user): (preferences)
where InterestCollection.getActivities (): (activities)
where InterestCollection.getConnections (): (connections)
where StoryGeneration.getStories (user): (stories)
where startedActivities are the Activities associated with stories
where activities is not empty
then InterestGeneration.generateSuggestions (user, preferences, activities, connections, startedActivities)
```

The application retrieves the latest preferences and previously started Stories before generating new suggestions. This prevents suggesting Activities that users have already started exploring.

### Note on Requesting and synchronization

`Requesting` represents user-facing requests handled by the application boundary. These requests must be implemented in assembly or defined through a Requesting interface.

`startedActivities` is derived from the Activities associated with the user's Stories returned by `StoryGeneration.getStories`. It is not stored separately by InterestGeneration.

The application's trusted setup code registers the initial Topics, Activities, and Connections. Users cannot modify the shared catalog through ordinary requests.

The Interest Map is a frontend visualization of InterestCollection, StoryGeneration, and ExplorationTracking. No separate InterestMap concept or synchronization reaction is needed.
