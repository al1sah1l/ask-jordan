# Ask Jordan Concept Design


## Authentication


## Account

## InterestCollection

## IdeaGeneration

## StoryGeneration

## AvatarCustomization

## InterestMap

## ExplorationTracking

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
