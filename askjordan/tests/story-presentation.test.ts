import { expect, test } from "bun:test";
import { narrativeParagraphs } from "../web/src/utils/narrative.ts";
import { chapterProgress } from "../web/src/utils/storyProgress.ts";

test("dialogue and speaker turns stay separate while older dense prose becomes skimmable", () => {
  const prose = "Alex opened the notebook. Jordan pointed to a blank page. The first scene needed a clear goal. Alex wrote one sentence.";
  expect(narrativeParagraphs(prose)).toEqual([
    "Alex opened the notebook. Jordan pointed to a blank page.",
    "The first scene needed a clear goal. Alex wrote one sentence.",
  ]);
  expect(narrativeParagraphs('Alex opened the notebook.\r\n\r\n“Where should we begin?”\r\n“With the main character,” Jordan said.')).toEqual([
    "Alex opened the notebook.", "“Where should we begin?”", "“With the main character,” Jordan said.",
  ]);
});

test("presentation keeps user-generated markup as plain text", () => {
  expect(narrativeParagraphs('<script>alert("test")</script>')).toEqual(['<script>alert("test")</script>']);
  expect(narrativeParagraphs(" \n ")).toEqual([]);
});

test("chapter progress fills at each milestone, including saved reflection completion", () => {
  expect(chapterProgress().percent).toBe(0);
  expect(chapterProgress("first-choice").percent).toBe(25);
  expect(chapterProgress("second-choice").percent).toBe(50);
  expect(chapterProgress("awaiting-reflection").percent).toBe(75);
  expect(chapterProgress("reflected").percent).toBe(100);
});
