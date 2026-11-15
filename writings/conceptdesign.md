# Ask Jordan Concept Design


## Authentication


## Account

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

## IdeaGeneration

## StoryGeneration

## AvatarCustomization

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
