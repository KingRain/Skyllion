// Sends sample answers straight to Nimble v3 and prints raw scores + resulting tier. Run: node scripts/simulate.mjs
import { judge } from "../lib/nimble.js";
import { tierFor, TIERS } from "../lib/tiers.js";
import { BY_ID } from "../lib/prompts.js";

const CASES = {
  spc01: ["the moon", "titan", "europa", "phobos", "callisto", "hyperion", "miranda", "dactyl", "mars", "jupiter", "luna"],
  air01: ["delta", "emirates", "ryanair", "aer lingus", "air koryo", "pan am", "boeing", "nasa"],
  geo02: ["france", "germany", "malta", "slovenia", "luxembourg", "norway", "switzerland", "uk"],
  mix01: ["chrome", "firefox", "opera", "vivaldi", "lynx", "netscape navigator", "google", "windows"],
  wrd03: ["racecar", "level", "kayak", "tattarrattat", "rotavator", "banana"],
  mov06: ["superman", "iron man", "storm", "mary poppins", "dumbo", "batman"],
  air07: ["alpha", "tango", "foxtrot", "juliett", "quebec", "apple"],
  mix09: ["cumulus", "cirrus", "noctilucent", "mammatus", "the cloud (icloud)", "fog"],
};

for (const [pid, answers] of Object.entries(CASES)) {
  console.log(`\n== ${BY_ID[pid].text}`);
  for (const a of answers) {
    const t0 = Date.now();
    const v = await judge(BY_ID[pid].text, a);
    const k = tierFor(v);
    console.log(
      `${a.padEnd(22)} valid ${v.valid.toFixed(2)}  clever ${v.clever.toFixed(2)}  rarity ${v.rarity.toFixed(2)}  -> ${(k ? TIERS[k].name : "Grounded").padEnd(18)} ${Date.now() - t0}ms`
    );
  }
}
