import { performance } from "node:perf_hooks";
import { buildAnswerIndex, normalizeAnswer, searchAnswers } from "../lib/search.js";

const percentile = (values, p) => values.toSorted((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const measure = (run, queries, rounds) => {
  for (let i = 0; i < 30; i++) run(queries[i % queries.length]);
  const samples = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    run(queries[i % queries.length]);
    samples.push((performance.now() - start) * 1000);
  }
  return {
    p50_us: Number(percentile(samples, 0.50).toFixed(2)),
    p95_us: Number(percentile(samples, 0.95).toFixed(2)),
    p99_us: Number(percentile(samples, 0.99).toFixed(2)),
    max_us: Number(Math.max(...samples).toFixed(2)),
  };
};

const sizes = [1_000, 10_000, 100_000];
const results = [];

for (const size of sizes) {
  const answers = Array.from({ length: size }, (_, i) => `Entity${String(i).padStart(6, "0")} Star`);
  const queries = Array.from({ length: 300 }, (_, i) => `Entity${String((i * 997) % size).padStart(6, "0")}`);
  const heapBefore = process.memoryUsage().heapUsed;
  const buildStart = performance.now();
  const index = buildAnswerIndex(answers);
  const buildMs = performance.now() - buildStart;
  const indexHeapBytes = process.memoryUsage().heapUsed - heapBefore;
  const normalized = answers.map((answer) => normalizeAnswer(answer));
  const broadQueries = Array(100).fill("en");

  results.push({
    entities: size,
    index_build_ms: Number(buildMs.toFixed(2)),
    heap_delta_mb: Number((indexHeapBytes / 1024 / 1024).toFixed(2)),
    indexed_search: measure((query) => searchAnswers(index, query), queries, 300),
    indexed_broad_prefix: measure((query) => searchAnswers(index, query), broadQueries, 100),
    linear_prefix_comparator: measure((query) => {
      const key = normalizeAnswer(query);
      return normalized.filter((answer) => answer.startsWith(key)).slice(0, 6);
    }, queries, 300),
    linear_broad_prefix_comparator: measure((query) => {
      const key = normalizeAnswer(query);
      return normalized.filter((answer) => answer.startsWith(key)).slice(0, 6);
    }, broadQueries, 100),
  });
}

const goldenIndex = buildAnswerIndex([
  { answer: "Christopher Nolan", hits: 3 },
  { answer: "Chris Evans", hits: 10 },
  { answer: "Interstellar", hits: 1 },
  { answer: "New York", hits: 4 },
  { answer: "Beyonc\u00e9", hits: 2 },
]);
const golden = [
  { query: "chr", relevant: ["Christopher Nolan", "Chris Evans"] },
  { query: "interste", relevant: ["Interstellar"] },
  { query: "new yor", relevant: ["New York"] },
  { query: "beyonce", relevant: ["Beyonc\u00e9"] },
  { query: "no-such-answer", relevant: [] },
];
let relevantReturned = 0, returned = 0, reciprocalRank = 0, top1 = 0;
for (const test of golden) {
  const matches = searchAnswers(goldenIndex, test.query);
  if (!test.relevant.length) continue;
  const rank = matches.findIndex((match) => test.relevant.includes(match));
  if (rank === 0) top1++;
  if (rank >= 0) reciprocalRank += 1 / (rank + 1);
  relevantReturned += matches.filter((match) => test.relevant.includes(match)).length;
  returned += matches.length;
}

console.log(JSON.stringify({
  runtime: process.version,
  platform: `${process.platform}/${process.arch}`,
  search_execution_unit: "microseconds",
  golden_cases: golden.length,
  golden_top1_accuracy: Number((top1 / 4).toFixed(3)),
  golden_precision_at_6: Number((relevantReturned / returned).toFixed(3)),
  golden_mrr: Number((reciprocalRank / 4).toFixed(3)),
  results,
}, null, 2));