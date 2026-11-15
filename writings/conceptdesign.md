# Ask Jordan Concept Design


## Authentication


## Account

## InterestCollection

## IdeaGeneration

**concept** IdeaGeneration [User, Interest, Profile]

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


**asides** IdeaGeneration focuses on initially taking the interests that the user identifies at profile creation and generating new, related interests and career topics for the user to explore. As the user spends time navigating and exploring these LLM-generated Interests, they can mark each interest as something that they are either interested or uninterested in. With this division of interests, the LLM can generate new interests that they think the user would be excited to explore.


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

**asides** The Reflecting concept is designed to be utilized after a user explores a generated story about an interest. It is meant as a space for the user to reflect on their thoughts about an interest/career path.
