
import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Ask Jordan",

  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Sessions.md", import.meta.url),
      new URL("./design/compositions/Accounts.md", import.meta.url),
      new URL("./design/compositions/ExplorationFlow.md", import.meta.url),
      new URL("./design/compositions/InterestApi.md", import.meta.url),
      new URL("./design/compositions/Reflecting.md", import.meta.url),
    ],
  },
};
