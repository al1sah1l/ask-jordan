# Ask Jordan Concept Design

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

where the username is 3 to 32 letters, digits, underscores, or hyphens, the password is 8 to 128 characters, and the username is not already registered

then add a new account with that username and a salted verifier derived from the password, and return the account.

authenticate (username: String, password: String): (account: Account)

where an account exists for the username and the password matches its verifier

then return that account.

## Account

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

**purpose** generate ideas for a user to explore based on their profile, allow users to explore new aspects of their interests that they might never have known about otherwise (ex: George is interested in soccer -> generates ideas like sports photography)

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

**asides** InterestGeneration focuses on initially taking the interests that the user identifies at profile creation and generating new, related interests and career topics for the user to explore. As the user spends time navigating and exploring these LLM-generated Interests, they can mark each interest as something that they are either interested or uninterested in. With this division of interests, the LLM can generate new interests that they think the user would be excited to explore.

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

## InterestMap

## ExplorationTracking

**concept** ExplorationTracking [User, Interest, Chapter]

**purpose** keep track of users' previous explorations and their progress. Prevents users from losing track of activities they have explored and allows them to return to previous experiences.

**principle** when a user chooses an interest to explore, an exploration record is created. The user can progress through story chapters, complete explorations, and review their exploration history.

**state**

a set of Explorations, each containing an owner User, an Interest, a Chapter, and a status

a status that can be started or completed

**actions**

startExploration (user: User, interest: Interest, chapter: Chapter): (exploration: Exploration)

> **where** chapter exists and user does not already have an exploration for chapter

> **then** create a new Exploration for user with interest, chapter, and status started, and return the exploration

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

> **then** return all explorations belonging to user with status completed

## Reflecting

**concept** Reflecting [User, Interest]

**purpose** provide users with a space to reflect on their thoughts and opinions about an explored interest. prevents users from not being able to explore their own personal thoughts about some experience.

**principle** after a user completes an interest story, they are provided with a space to record their thoughts.

**state**

a set of Journals with an owner User, and set of Pages

a Page containing an Interest and text String

**actions**

createJournal (user: User): (journal: Journal)

> **where** user does not yet have a journal

> **then** create an empty Journal for user

write (user: User, text: String, interest: Interest): (page: Page)

> **where** user has a journal and there is no page in their journal with Interest interest

> **then** add a new Page, page, to user's Journal, with interest and text and return the new page to the user

edit (user: User, text: String, interest: Interest): (page: Page)

> **where** user has a journal and there is a page in their journal with the identifier of interest

> **then** set the text of the page about interest to be the new text, and return the edited page to the user.

read (user: User, interest: Interest): (page: Page)

> **where** user has a journal and there is a page in their journal with identifier of interest

> **then** return to the user the text of the page identified by interest.

**asides** The Reflecting concept is designed to be utilized after a user explores a generated story about an interest. It is meant as a space for the user to reflect on their thoughts about an interest/career path.
