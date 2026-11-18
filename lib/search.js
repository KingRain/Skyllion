const tokenize = (value) => value.match(/[\p{L}\p{N}+#]+/gu) || [];
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export const normalizeAnswer = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const compareRanked = (a, b) =>
  Number(b.exact) - Number(a.exact) ||
  Number(b.phrasePrefix) - Number(a.phrasePrefix) ||
  b.exactTokens - a.exactTokens ||
  b.prefixLength - a.prefixLength ||
  b.entry.hits - a.entry.hits ||
  compareText(a.entry.key, b.entry.key) ||
  compareText(a.entry.answer, b.entry.answer);

export function buildAnswerIndex(answers) {
  const entries = [];
  const prefixes = new Map();
  const exactTokens = new Map();
  const exact = new Map();

  for (const item of answers) {
    const answer = String(typeof item === "string" ? item : item?.answer ?? "").trim();
    const key = normalizeAnswer(answer);
    const tokens = tokenize(key);
    if (!answer || !tokens.length) continue;

    entries.push({ answer, key, tokens, hits: Number(item?.hits) || 0 });
  }

  entries.sort((a, b) => compareText(a.key, b.key) || compareText(a.answer, b.answer));
  const phraseEntries = entries;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    let exactMatches = exact.get(entry.key);
    if (!exactMatches) exact.set(entry.key, (exactMatches = []));
    exactMatches.push(index);
    for (const token of entry.tokens) {
      let tokenMatches = exactTokens.get(token);
      if (!tokenMatches) exactTokens.set(token, (tokenMatches = []));
      tokenMatches.push(index);
      for (let length = 2; length <= token.length; length++) {
        const prefix = token.slice(0, length);
        let matches = prefixes.get(prefix);
        if (!matches) prefixes.set(prefix, (matches = []));
        matches.push(index);
      }
    }
  }

  return { entries, phraseEntries, prefixes, exactTokens, exact };
}

export function searchAnswers(index, raw, limit = 6) {
  const key = normalizeAnswer(raw);
  const queryTokens = tokenize(key);
  if (!key || key.replace(/\s/g, "").length < 2 || !queryTokens.length || limit <= 0) return [];

  if (queryTokens.length === 1) {
    const results = [];
    const seen = new Set();
    const add = (indices) => {
      for (const index of indices || []) {
        const answer = index.answer ?? index;
        if (seen.has(answer)) continue;
        seen.add(answer);
        results.push(answer);
        if (results.length >= limit) return true;
      }
      return false;
    };
    if (add((index.exact.get(key) || []).map((id) => index.entries[id]))) return results;

    let low = 0, high = index.phraseEntries.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (index.phraseEntries[middle].key < key) low = middle + 1;
      else high = middle;
    }
    for (let i = low; i < index.phraseEntries.length && index.phraseEntries[i].key.startsWith(key); i++) {
      if (add([index.phraseEntries[i]])) return results;
    }
    if (add((index.exactTokens.get(key) || []).map((id) => index.entries[id]))) return results;
    const tokenPrefix = index.prefixes.get(key) || [];
    for (const id of tokenPrefix) if (add([index.entries[id]])) break;
    return results;
  }

  const postings = queryTokens.map((token) => index.prefixes.get(token));
  if (postings.some((matches) => !matches)) return [];
  postings.sort((a, b) => a.length - b.length);

  const candidates = new Set(postings[0]);
  for (let posting = 1; posting < postings.length; posting++) {
    const allowed = new Set(postings[posting]);
    for (const candidate of candidates) if (!allowed.has(candidate)) candidates.delete(candidate);
  }

  const ranked = [];
  const seenAnswers = new Set();
  for (const candidate of candidates) {
    const entry = index.entries[candidate];
    if (seenAnswers.has(entry.answer)) continue;
    let tokenPosition = 0;
    let exactTokens = 0;
    let prefixLength = 0;
    let ordered = true;

    for (const queryToken of queryTokens) {
      const position = entry.tokens.findIndex((token, i) => i >= tokenPosition && token.startsWith(queryToken));
      if (position < 0) {
        ordered = false;
        break;
      }
      tokenPosition = position + 1;
      if (entry.tokens[position] === queryToken) exactTokens++;
      prefixLength += queryToken.length;
    }
    if (!ordered) continue;

    seenAnswers.add(entry.answer);
    const result = {
      entry,
      exact: entry.key === key,
      phrasePrefix: entry.key.startsWith(key),
      exactTokens,
      prefixLength,
    };
    let low = 0, high = ranked.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compareRanked(ranked[middle], result) <= 0) low = middle + 1;
      else high = middle;
    }
    if (low < limit) {
      ranked.splice(low, 0, result);
      if (ranked.length > limit) ranked.pop();
    }
  }
  return ranked.map((result) => result.entry.answer);
}