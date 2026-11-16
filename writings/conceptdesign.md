# Concept Design

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

> where the username is 3 to 32 letters, digits, underscores, or hyphens, the password is 8 to 128 characters, and the username is not already registered
>
> then add a new account with that username and a salted verifier derived from the password, and return the account

authenticate (username: String, password: String): (account: Account)

> where an account exists for the username and the password matches its verifier
>
> then return that account

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

> then delete every expired session, add a new session for that user expiring 24 hours from now, and return the session and when it expires

current (session: Session): (user: User)

> where the session is known and has not expired
>
> then return the user the session was started for

end (session: Session)

> where the session is known and has not expired
>
> then delete the session

**note**

The user on a session is the account Authenticating just returned. After sign-in, other actions recover that user by calling `current` on the session.

## Account

**concept** Account [User, Interest]

**purpose** allow users to describe themselves so that their exploration experience can reflect their background and starting interests without requiring them to repeatedly enter the same information.

**principle** when a user creates an account profile, they provide a display name, an optional description of themselves, and select initial interests. They can later retrieve their profile and update their name or description. Their initial interests provide a starting point for discovering new interests.

**state**

a set of Profiles, each containing:

- a unique owner User
- a name String
- an about String
- an initialInterests set of Interests

**actions**

createAccount (user: User, name: String, about: String, initialInterests: set Interest): (profile: Profile)

where user does not yet have a profile and name is not blank

then create a Profile belonging to user with the given name, about, and initialInterests, and return the profile. The about text and initialInterests may be empty.

updateProfile (user: User, name: String, about: String)

where user has a profile and name is not blank

then replace the profile’s name and about with the supplied values.

getProfile (user: User): (profile: Profile, name: String, about: String, initialInterests: set Interest)

where user has a profile

then return the user’s profile and its stored name, about, and initialInterests without changing them.

## InterestCollection

**concept** InterestCollection [User, Interest]

**purpose** allow users to maintain and organize their interests as they discover new activities. Prevents users from losing track of what they are interested in and missing opportunities to explore related interests.

**principle** when a user creates their profile, they can add their initial interests to their collection. As they discover new interests, they can add them, remove interests they are no longer interested in, and connect related interests to explore different paths within the same field.

**state**

a set of Collections with an owner User and a set of Interests

an Interest containing a name String and a description String

a set of Connections, each connecting two Interests within a user's collection

**actions**

createCollection (user: User): (collection: Collection)

> **where** user does not yet have a collection

> **then** create an empty Collection for user

addInterest (user: User, interest: Interest): (collection: Collection)

> **where** user has a collection and interest is not already in the collection

> **then** add interest to the user's collection and return the updated collection

removeInterest (user: User, interest: Interest): (collection: Collection)

> **where** user has a collection and interest is in the collection

> **then** remove interest and its connections from the user's collection and return the updated collection

connectInterests (user: User, interest1: Interest, interest2: Interest): (connection: Connection)

> **where** user has a collection containing both interests, the interests are different, and no connection between them exists

> **then** create a Connection between interest1 and interest2 and return the new connection

getInterests (user: User): (interests: set Interest)

> **where** user has a collection

> **then** return all interests in the user's collection

getRelatedInterests (user: User, interest: Interest): (interests: set Interest)

> **where** user has a collection containing interest

> **then** return all interests connected to interest in the user's collection

## InterestGeneration

**concept** InterestGeneration [User, Interest, Profile]

**purpose** generate ideas for a user to explore based on their profile, allow users to explore new aspects of their interests that they might never have known about otherwise (ex: a user interested in soccer -> generates ideas like sports photography)

**principle** using the users profile, a LLM generates new interests that a user could potentially be interested in. for example, a user has selected Soccer as one of their interests. initialGeneration returns sports photography and coaching.

**state**
a set of Users with a set of user-interested Interests

a set of Users with a set of LLM-generated Interests

a set of Users with a set of uninterested Interests

**actions**

initialGeneration (user: User): (interests: set of Interest)

> **where** user does have user-interested Interests and does not have LLM-generated Interests

> **then** use an LLM to generate new, related interests based on user's user-interested Interests. Add these generated Interests to the user's LLM-generated set. Return the LLM-generated interests to the user.

modifyingGeneration (user: User): (interests: set of Interest)

> **where** user does have user-interested Interests and a LLM-generated Interests of size less than 3

> **then** use an LLM to generate new, related interests based on the user's user-interested and user's uninterested, steering towards interests like those in user-interested and away from those in user's uninterested. Add these generated Interests to the user's LLM-generated set. Return the LLM-generated interests to the user.

interested(user: User, interest: Interest)

> **where** user has interest in their set of LLM-generated Interests

> **then** remove interest from user's LLM-generated and add interest to user's user-interested

uninterested(user: User, interest: Interest)

> **where** user has interest in their set of LLM-generated Interests

> **then** remove interest from user's LLM-generated and add interest to user's uninterested

addInitialInterest (user: User, interest: Interest)

> **where** interest is not already in the user's user-interested Interests

> **then** add interest to the user's user-interested Interests

**asides** InterestGeneration focuses on initially taking the interests that the user identifies at profile creation and generating new, related interests and career topics for the user to explore. As the user spends time navigating and exploring these LLM-generated Interests, they can mark each interest as something that they are either interested or uninterested in. With this division of interests, the LLM can generate new interests that they think the user would be excited to explore.

**note**

`initialGeneration` only runs when this concept already has interests the user wants. It does not read the profile description. Those interests arrive through `addInitialInterest`, which the collection calls when an interest is added there. If that has not happened, there is nothing to generate from.

## StoryGeneration

**concept** StoryGeneration [User, Interest]

**purpose** help users explore an unfamiliar interest through a personalized narrative that connects their choices to concrete activities they can try.

**principle** when a user chooses an interest, they receive the first chapter of a story introducing that interest through a relatable situation. The chapter asks what they would do next. Their answer shapes the following chapter, allowing them to explore different aspects of the interest. The final chapter concludes the story and suggests a related activity to try.

**state**

a set of Stories, each containing:

- an owner User
- an Interest
- a topic String describing the interest
- a context String containing personalization information
- an ordered sequence of Chapters

a set of Chapters, each containing:

- a story Story
- a position Integer
- a text String
- an optional question String
- an optional answer String
- an optional activity String

Each Story contains between one and three Chapters.

**actions**

generateStory (user: User, interest: Interest, topic: String, context: String): (story: Story, chapter: Chapter)

**where** topic is not blank

**then** use an LLM to generate the first chapter of a new story about topic, personalized using context. Create a Story belonging to user and associated with interest, topic, and context. Create its first Chapter with position 1, generated text, a question, and no answer or activity. Return the story and chapter.

continueStory (user: User, story: Story, answer: String): (chapter: Chapter)

where story belongs to user, its latest chapter has an unanswered question, answer is not blank, and the story contains fewer than three chapters

then use an LLM to generate the next chapter using the story’s topic, context, previous chapters, previous answers, and the supplied answer. Record the supplied answer on the previous chapter and append the new Chapter with the next position.

If the new chapter has position 2, give it a question and no activity. If it has position 3, conclude the story, give it a concrete activity related to the interest, and give it no question. Return the new chapter.

getStory (user: User, story: Story): (chapters: sequence Chapter)

where story belongs to user

then return its chapters in position order, including their text, questions, recorded answers, and activities, without changing the story.

**note**

`context` is the about text from the user's profile, not a second copy of the profile. When a model call cannot be used, `generateStory` can return a story we wrote ahead of time for that interest, and the rest of the path still has a chapter to show.

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

> where the user does not already hold the item
>
> then record that the user holds the item

equip (user: User, item: Item, slot: Slot)

> where the user holds the item
>
> then make that item the one worn in the slot, replacing whatever item was already worn there

clear (user: User, slot: Slot)

> where the user is wearing an item in the slot
>
> then remove it from that slot. The user still holds the item

getEquipped (user: User): (worn: set Worn)

> where the user has any holdings
>
> then return the items the user is wearing and the slot of each, without changing them. A user wearing nothing returns an empty set

<<<<<<< HEAD
=======
**note**

`grant` has no caller. The user can only equip an item they already hold, so until some other action grants one, there is nothing to put on the avatar.

## InterestMap

**note**

The map is a view of the interests in the collection and the explorations that have been completed. It does not keep its own copy, so nothing has to write to it when an exploration finishes.

>>>>>>> 855fb39 (polishing v1)
## ExplorationTracking

**concept** ExplorationTracking [User, Interest, Story]

**purpose** keep track of users' previous explorations and their progress. Prevents users from losing track of activities they have explored and allows them to return to previous experiences.

**principle** when a user starts a story about an interest, an exploration record is created. The user progresses through the story's chapters and marks the story as completed when they finish exploring the activity. The completed exploration remains in their history.

**state**

a set of Explorations, each containing:
- an owner User
- an Interest
- a Story
- a status (started or completed)

**actions**

startExploration (user: User, interest: Interest, story: Story): (exploration: Exploration)

> **where** user does not already have an exploration for story

> **then** create a new Exploration for user with interest, story, and status started, and return the exploration

completeExploration (user: User, exploration: Exploration): (exploration: Exploration)

> **where** exploration belongs to user and has status started

> **then** change the exploration's status to completed and return the updated exploration

getExploration (user: User, exploration: Exploration): (exploration: Exploration)

> **where** exploration belongs to user

> **then** return the exploration and its current status

getExplorationHistory (user: User): (explorations: set Exploration)

> **where** user has at least one exploration

> **then** return all explorations belonging to user

getCompletedExplorations (user: User): (explorations: set Exploration)

> **where** user has at least one completed exploration

> **then** return all completed explorations belonging to user

**note**

An exploration represents an entire story, not an individual chapter. Users explicitly mark an exploration as completed after finishing the story. Completing a chapter does not automatically complete the exploration.

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

edit (user: User, chapter: Chapter, text: String): (page: Page)

> **where** user has a journal and there is a page in their journal with chapter

> **then** update the text of the page and return the edited page

read (user: User, chapter: Chapter): (page: Page)

> **where** user has a journal and there is a page in their journal associated with chapter

> **then** return the page associated with chapter

getJournal (user: User): (pages: set Page)

> **where** user has a journal

> **then** return all pages belonging to the user's journal

**note**

A journal holds at most one page per chapter, and the page is the user's writing about that chapter. Saving the page does not mark the story or the exploration complete.

# Reactions

**Account creation -> Initialize interests**

```
when Account.createAccount (user, name, about, initialInterests): (profile)
then InterestCollection.createCollection (user)
```

```
when InterestCollection.createCollection (user): (collection)
where Account.getProfile (user): (profile, name, about, initialInterests)
where interest is in initialInterests
then InterestCollection.addInterest (user, interest)
```

The collection has to exist before an interest can be put in it, so the empty collection is created first. If the user did not name any interests, the collection is still created and the second reaction has nothing to add.

**Interest added → Update InterestGeneration**

```
when InterestCollection.addInterest (user, interest): (collection)
then InterestGeneration.addInitialInterest (user, interest)
```

**Onboarding completed -> Generate suggested activities**

```
when Requesting.finishOnboarding (session)
where Sessioning.current (session): (user)
where InterestCollection.getInterests (user) is not empty
then InterestGeneration.initialGeneration (user)
```

`initialGeneration` only runs when InterestGeneration already has interests the user wants. Those get there when an interest is added to the collection. If that copy has not happened, this reaction does not run.

**Activity selected -> Generate story**

```
when Requesting.selectActivity (session, interest, topic)
where Sessioning.current (session): (user)
where Account.getProfile (user): (profile, name, about, initialInterests)
then StoryGeneration.generateStory (user, interest, topic, context: about)
```

`about` is the description saved on the profile. `generateStory` does not take an argument by that name. It takes `context`, so the description we just read is passed in as the context.

**Story generated -> Start exploration**

```
when StoryGeneration.generateStory (user, interest, topic, context): (story, chapter)
then ExplorationTracking.startExploration (user, interest, story)
```

The story that comes back is what opens the exploration. The chapter that comes back with it is not an exploration, and finishing a chapter does not finish this record.

**Reflection submitted -> Save reflection**

```
when Requesting.submitReflection (session, story, chapter, text)
where Sessioning.current (session): (user)
where StoryGeneration.getStory (user, story): (chapters)
where chapter is in chapters
then Reflecting.write (user, story, chapter, text)
```

**Reflection saved -> Generate next chapter**

```
when Reflecting.write (user, story, chapter, text): (page)
where StoryGeneration.getStory (user, story): (chapters)
where chapter is the latest chapter in chapters
where chapter.question is not empty
where size(chapters) < 3
then StoryGeneration.continueStory (user, story, text)
```

<<<<<<< HEAD
=======
The text the user just saved is the answer `continueStory` uses. This only happens when that chapter is the latest one, it still asks a question, and the story has fewer than three chapters.

>>>>>>> 855fb39 (polishing v1)
**Story marked complete → Complete exploration**

```
when Requesting.completeStory (session, story)
where Sessioning.current (session): (user)
where ExplorationTracking.getExplorationHistory (user): (explorations)
where exploration is in explorations and exploration.story = story
then ExplorationTracking.completeExploration (user, exploration)
```

The user marks the story complete, and that is what completes the exploration. Saving a reflection does not.

**Account created → Create reflection journal**

```
when Account.createAccount (user, name, about, initialInterests): (profile)
then Reflecting.createJournal (user)
```
