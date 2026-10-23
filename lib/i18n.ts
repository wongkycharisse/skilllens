import type { Lang } from "./schema";

// Add a language: add it to Lang in schema.ts, then add a dictionary here with every key.
// SYNTHETIC PLACEHOLDER: the Pidgin strings need native-speaker review.
const en = {
  langName: "English",
  chooseLang: "Choose your language",
  levelUp: "10-minute level-up",
  lowStakes: "This is practice. There is no score and no wrong answer.",
  yourChallenge: "Your challenge",
  startAnswer: "Start my answer",
  level: "Level",
  answerLabel: "Your answer",
  type: "Type",
  speak: "Speak",
  photo: "Photo",
  speakStart: "Start speaking",
  speakStop: "Stop",
  speakUnsupported: "Speaking is not available on this phone. Please type your answer.",
  photoLabel: "Take a photo of your written answer",
  photoReading: "Reading your photo…",
  photoCheck: "Check the text from your photo and fix any mistakes.",
  getFeedback: "Get feedback",
  thinking: "Thinking…",
  didWell: "Did well",
  toImprove: "To improve",
  tryLevel2: "Try Level 2: make your answer better",
  level2Intro: "Use the tip to improve your answer.",
  save: "Save to my profile",
  saved: "Saved to your profile",
  practiceLabel: "Practice sample, not a certification",
  error: "Something went wrong. Please try again.",
};

const pcm: typeof en = {
  langName: "Pidgin",
  chooseLang: "Choose your language",
  levelUp: "10-minute level-up",
  lowStakes: "Na practice be this. No score, no wrong answer.",
  yourChallenge: "Your challenge",
  startAnswer: "Start my answer",
  level: "Level",
  answerLabel: "Your answer",
  type: "Type",
  speak: "Talk",
  photo: "Photo",
  speakStart: "Start to talk",
  speakStop: "Stop",
  speakUnsupported: "Talk no dey work for this phone. Abeg type your answer.",
  photoLabel: "Snap the answer wey you write",
  photoReading: "We dey read your photo…",
  photoCheck: "Check the text from your photo, correct any mistake.",
  getFeedback: "Get feedback",
  thinking: "We dey think…",
  didWell: "Wetin you do well",
  toImprove: "Wetin you fit improve",
  tryLevel2: "Try Level 2: make your answer better",
  level2Intro: "Use the tip take improve your answer.",
  save: "Save am for my profile",
  saved: "E don save for your profile",
  practiceLabel: "Practice sample, no be certificate",
  error: "Something no work. Abeg try again.",
};

const dictionaries: Record<Lang, typeof en> = { en, pcm };

export type MessageKey = keyof typeof en;
export const t = (lang: Lang, key: MessageKey) => dictionaries[lang][key];
export const languages = Object.keys(dictionaries) as Lang[];
