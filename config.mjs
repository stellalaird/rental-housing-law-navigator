// The reskin point. server.mjs serves title/tagline/examples at /api/config; the page falls back to the same values from public/replay.json.
export default {
  title: "Rental Housing Law Navigator",
  tagline: "Which housing rules apply to this address on a given date? Not legal advice.",
  systemPrompt: "You are a helpful assistant.", // unused by the lookup UI; /api/chat is no longer called by the page
  examples: ["6238 DE LONGPRE AVE", "1031-1035 CLINTON ST"],
};
