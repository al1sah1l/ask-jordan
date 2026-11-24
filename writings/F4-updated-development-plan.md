# Updated Development Plan

## Progress Made
In the MVP, we made a lot of progress from our initial design. The biggest changes are that we went from a series of concepts to an initial product that has a functioning backend and frontend. We successfully wrote concept TypeScript files for all 9 of the concepts that we designed.

The concepts we focused on implementing for our MVP are Account, Authenticating, InterestCollection, ExplorationTracking, Sessioning, and StoryGeneration. These concepts define the MVP. We implemented these concepts both on the backend and the frontend.


## Still To Do
There are multiple concepts and improvements on our still to do list. The first is AvatarCustomization. This concept is something we wanted to focus on for our Beta version rather than for MVP because it is not necessary for the implementation of our application. However, we do want to add AvatarCustomization because we think it will help users engage with the app and continue returning to the application for use.

Another concept still on our to do list is Reflecting. We wrote the backend necessary for the Reflecting concept. However, we did not complete the frontend yet. We want reflection to help finetune the AI prompting with ensuring that users are showed possible career futures that they are interested in.


## What's Changed
We reworked our ExplorationTracking and InterestCollection concept between problem framing and the completion of our MVP stage.

In InterestCollection, we modified the concept to have two distinct categories, Topic and Activity, rather than just Interest. This distinction allows for more specificity of activities, while also grouping them by like topics. An example of this is that a Topic can be Music, with Activities such as Songwriting and Music Production. This new specificity and grouping will help our application prompt a LLM to generate new interests to explore.

Meanwhile, ExplorationTracking has been simplified to only base its tracking off of Stories, rather than Interests and Stories. This is because ExplorationTracking is meant for a user to see what stories they have spent time on and explored. Stories carry Interest information within them, which can be accessed necessary.
