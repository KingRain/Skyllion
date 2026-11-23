// Prompt bank. The judge model judges answers but can't write prompts, so these are hand-written.
// ponytail: static list, move to a Neon table when packs/editorial tooling are needed.
export const PROMPTS = [
  // Flight & aviation
  ["air01", "Name an airline", "Aviation"],
  ["air02", "Name a type of aircraft (not a brand)", "Aviation"],
  ["air03", "Name an airport by its full name", "Aviation"],
  ["air04", "Name a part of an aeroplane", "Aviation"],
  ["air05", "Name an aircraft manufacturer", "Aviation"],
  ["air06", "Name a famous aviator or pilot", "Aviation"],
  ["air07", "Name a word in the NATO phonetic alphabet", "Aviation"],
  ["air08", "Name a military aircraft", "Aviation"],
  ["air09", "Name a thing you can find on a commercial flight", "Aviation"],
  ["air10", "Name a bird that can fly", "Aviation"],
  ["air11", "Name a flying insect", "Aviation"],
  ["air12", "Name something that floats in the sky", "Aviation"],
  // Space
  ["spc01", "Name a moon in our solar system", "Space"],
  ["spc02", "Name a constellation", "Space"],
  ["spc03", "Name a named star (not the Sun)", "Space"],
  ["spc04", "Name an astronaut or cosmonaut", "Space"],
  ["spc05", "Name a space mission or programme", "Space"],
  ["spc06", "Name a rocket or launch vehicle", "Space"],
  ["spc07", "Name a space agency", "Space"],
  ["spc08", "Name a dwarf planet or asteroid", "Space"],
  ["spc09", "Name a named comet", "Space"],
  ["spc10", "Name a space telescope or observatory", "Space"],
  ["spc11", "Name a galaxy", "Space"],
  ["spc12", "Name a sign of the zodiac", "Space"],
  // Words & language
  ["wrd01", "Name a word that rhymes with 'sky'", "Words"],
  ["wrd02", "Name a word that starts with 'astro'", "Words"],
  ["wrd03", "Name a palindrome", "Words"],
  ["wrd04", "Name a word with a double 'o'", "Words"],
  ["wrd05", "Name a synonym for 'fast'", "Words"],
  ["wrd06", "Name a five-letter word ending in 'y'", "Words"],
  ["wrd07", "Name a word that means 'very big'", "Words"],
  ["wrd08", "Name a language spoken in Asia", "Words"],
  ["wrd09", "Name a word borrowed into English from Japanese", "Words"],
  ["wrd10", "Name a word that starts with 'fl'", "Words"],
  ["wrd11", "Name a colour", "Words"],
  ["wrd12", "Name a unit of measurement", "Words"],
  // Movies
  ["mov01", "Name a movie set in space", "Movies"],
  ["mov02", "Name a movie about flying or pilots", "Movies"],
  ["mov03", "Name a Pixar film", "Movies"],
  ["mov04", "Name a film directed by Christopher Nolan", "Movies"],
  ["mov05", "Name a character from Star Wars", "Movies"],
  ["mov06", "Name a superhero who can fly", "Movies"],
  ["mov07", "Name a Best Picture Oscar winner", "Movies"],
  ["mov08", "Name a James Bond film", "Movies"],
  ["mov09", "Name a Studio Ghibli film", "Movies"],
  ["mov10", "Name a famous robot from film or TV", "Movies"],
  ["mov11", "Name an alien from film or TV", "Movies"],
  ["mov12", "Name a movie with a number in its title", "Movies"],
  // Sports
  ["spt01", "Name an Olympic sport", "Sports"],
  ["spt02", "Name an NBA team", "Sports"],
  ["spt03", "Name a sport played with a ball", "Sports"],
  ["spt04", "Name a Formula 1 driver (past or present)", "Sports"],
  ["spt05", "Name a Winter Olympics event", "Sports"],
  ["spt06", "Name a football (soccer) club", "Sports"],
  ["spt07", "Name a city that has hosted the Summer Olympics", "Sports"],
  ["spt08", "Name a tennis Grand Slam champion", "Sports"],
  ["spt09", "Name an extreme or air sport", "Sports"],
  ["spt10", "Name a martial art", "Sports"],
  ["spt11", "Name an NFL team", "Sports"],
  ["spt12", "Name a piece of sports equipment", "Sports"],
  // Geography
  ["geo01", "Name a country in Africa", "Geography"],
  ["geo02", "Name a European Union member state", "Geography"],
  ["geo03", "Name a capital city", "Geography"],
  ["geo04", "Name a mountain over 6,000 metres", "Geography"],
  ["geo05", "Name an island nation", "Geography"],
  ["geo06", "Name a US state", "Geography"],
  ["geo07", "Name a river", "Geography"],
  ["geo08", "Name a country whose flag has a star on it", "Geography"],
  ["geo09", "Name a desert", "Geography"],
  ["geo10", "Name a landlocked country", "Geography"],
  ["geo11", "Name a volcano", "Geography"],
  ["geo12", "Name a country in South America", "Geography"],
  // Grab bag
  ["mix01", "Name a web browser", "Misc"],
  ["mix02", "Name a programming language", "Misc"],
  ["mix03", "Name a board game", "Misc"],
  ["mix04", "Name a fruit", "Misc"],
  ["mix05", "Name a breed of dog", "Misc"],
  ["mix06", "Name a musical instrument", "Misc"],
  ["mix07", "Name a chemical element", "Misc"],
  ["mix08", "Name a cheese", "Misc"],
  ["mix09", "Name a type of cloud", "Misc"],
  ["mix10", "Name a weather phenomenon", "Misc"],
  // Harry Potter
  ["hp01", "Name a spell from Harry Potter", "Harry Potter"],
  ["hp02", "Name a Harry Potter spell used in a duel", "Harry Potter"],
  ["hp03", "Name a Harry Potter spell that begins with 'S'", "Harry Potter"],
  ["hp04", "Name a Harry Potter spell that moves or summons objects", "Harry Potter"],
  ["hp05", "Name a Harry Potter spell that makes light or fire", "Harry Potter"],
  ["hp06", "Name a Harry Potter spell that begins with 'A'", "Harry Potter"],
  ["hp07", "Name a Harry Potter spell used for defence or protection", "Harry Potter"],
  ["hp08", "Name a Harry Potter spell used for cleaning, repairing or tidying", "Harry Potter"],
  ["hp09", "Name a Harry Potter character who teaches at Hogwarts", "Harry Potter"],
  ["hp10", "Name a magical creature from Harry Potter", "Harry Potter"],
  ["hp11", "Name a Harry Potter spell that begins with 'L'", "Harry Potter"],
  ["hp12", "Name a Harry Potter spell with an effect on a person's body", "Harry Potter"],
  // Oscar-nominated foreign-language films
  ["osc01", "Name a foreign-language film nominated for an Oscar in any category", "Foreign Oscars"],
  ["osc02", "Name a French-language film nominated for an Oscar", "Foreign Oscars"],
  ["osc03", "Name a Spanish-language film nominated for an Oscar", "Foreign Oscars"],
  ["osc04", "Name an Italian-language film nominated for an Oscar", "Foreign Oscars"],
  ["osc05", "Name a Japanese-language film nominated for an Oscar", "Foreign Oscars"],
  ["osc06", "Name a German-language film nominated for an Oscar", "Foreign Oscars"],
  ["osc07", "Name a non-English film nominated for Best Picture", "Foreign Oscars"],
  ["osc08", "Name a non-English film that won an Oscar", "Foreign Oscars"],
  ["osc09", "Name a Korean, Chinese or Indian film nominated for an Oscar", "Foreign Oscars"],
  ["osc10", "Name a director of an Oscar-nominated foreign-language film", "Foreign Oscars"],
  ["osc11", "Name an Oscar-nominated foreign-language film released before 1990", "Foreign Oscars"],
  ["osc12", "Name an Oscar-nominated foreign-language film released since 2010", "Foreign Oscars"],
  // Cities with a colour in their nickname
  ["col01", "Name a city with a colour in its nickname", "Colourful Cities"],
  ["col02", "Name a city nicknamed for the colour blue", "Colourful Cities"],
  ["col03", "Name a city nicknamed for the colour pink or rose", "Colourful Cities"],
  ["col04", "Name a city with 'Golden' or 'Gold' in its nickname", "Colourful Cities"],
  ["col05", "Name a city with 'White' in its nickname", "Colourful Cities"],
  ["col06", "Name a city with 'Green' or 'Emerald' in its nickname", "Colourful Cities"],
  ["col07", "Name a city with 'Red' in its nickname", "Colourful Cities"],
  ["col08", "Name a city in India with a colour in its nickname", "Colourful Cities"],
  ["col09", "Name a US city with a colour in its nickname", "Colourful Cities"],
  ["col10", "Name a European city with a colour in its nickname", "Colourful Cities"],
  ["col11", "Name a city with 'Silver', 'Black' or 'Grey' in its nickname", "Colourful Cities"],
  ["col12", "Name a city nicknamed 'the ___ City' with a colour in the blank", "Colourful Cities"],
  // Mythology
  ["myt01", "Name a Greek god or goddess", "Mythology"],
  ["myt02", "Name a Norse god", "Mythology"],
  ["myt03", "Name an Egyptian god or goddess", "Mythology"],
  ["myt04", "Name a mythical creature", "Mythology"],
  ["myt05", "Name a hero from Greek mythology", "Mythology"],
  ["myt06", "Name a Roman god or goddess", "Mythology"],
  ["myt07", "Name a winged creature from myth or legend", "Mythology"],
  ["myt08", "Name one of the twelve labours of Hercules", "Mythology"],
  ["myt09", "Name a Titan from Greek mythology", "Mythology"],
  ["myt10", "Name a character from Arthurian legend", "Mythology"],
  // Music
  ["mus01", "Name a band that formed in the UK", "Music"],
  ["mus02", "Name a song with a colour in its title", "Music"],
  ["mus03", "Name a Beatles album", "Music"],
  ["mus04", "Name a classical composer", "Music"],
  ["mus05", "Name a song with 'sky', 'fly' or 'flying' in its title", "Music"],
  ["mus06", "Name a Taylor Swift album", "Music"],
  ["mus07", "Name a musical (stage or film)", "Music"],
  ["mus08", "Name a female solo artist who has won a Grammy", "Music"],
  ["mus09", "Name a music festival", "Music"],
  ["mus10", "Name a K-pop group", "Music"],
  // Food & drink
  ["fod01", "Name a type of pasta", "Food & Drink"],
  ["fod02", "Name a dish that originated in India", "Food & Drink"],
  ["fod03", "Name a sushi roll or sushi type", "Food & Drink"],
  ["fod04", "Name a cocktail", "Food & Drink"],
  ["fod05", "Name a spice", "Food & Drink"],
  ["fod06", "Name a street food from anywhere in the world", "Food & Drink"],
  ["fod07", "Name a type of bread", "Food & Drink"],
  ["fod08", "Name a vegetable that is green", "Food & Drink"],
  ["fod09", "Name a dessert from France or Italy", "Food & Drink"],
  ["fod10", "Name a type of tea or coffee drink", "Food & Drink"],
].map(([id, text, cat]) => ({ id, text, cat }));

export const BY_ID = Object.fromEntries(PROMPTS.map((p) => [p.id, p]));
export const LAUNCH_DAY = "2026-11-01";

// Daily ascents roll over at midnight US Eastern, like the original.
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

// Deterministic seeded shuffle, so every player gets the same prompts for the same seed.
export function shuffle(list, seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pickPrompts = (seed, n = 7) => shuffle(PROMPTS, seed).slice(0, n);

export function pastDays(from = LAUNCH_DAY, to = today()) {
  const out = [];
  for (let d = new Date(to + "T12:00:00Z"); d >= new Date(from + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1))
    out.push(d.toISOString().slice(0, 10));
  return out.slice(1); // excludes today
}
