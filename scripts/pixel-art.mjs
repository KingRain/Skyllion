// Generates every pixel-art sprite as a PNG strip (frames side by side) into public/px/.
//   node scripts/pixel-art.mjs            -> writes sprites
//   node scripts/pixel-art.mjs sheet.png  -> also writes a contact sheet for eyeballing
// No image deps: a tiny PNG encoder on node:zlib.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PAL = {
  k: "#10142e", // outline
  w: "#ffffff", l: "#dce6f7", g: "#9aa8c7", G: "#5b6788", d: "#343d5c",
  r: "#ff4f5e", R: "#b42a45",
  o: "#ff9f43", O: "#c9661c",
  y: "#ffd166", Y: "#fff4c2",
  e: "#62e48b", E: "#2c9a5a",
  b: "#5ce1ff", B: "#2f7fe0", n: "#1d3d8f",
  p: "#b78cff", P: "#7048d8",
  s: "#c9d4ea", t: "#7f8db0",
};

// ---------------- sprites: each is an array of frames, each frame an array of rows ----------------
const plane = (prop) => [
  "......................",
  ".kk...................",
  ".kRk..................",
  ".krRk......kkkk.......",
  ".krrRk....kbbwbk......",
  ".krrrRkkkkkbbbbbkkk...",
  "kkrrrrrrrrrrrrrrrrrk..",
  "krrrrrrrrrrrrrrrrrrryk",
  "kwwwwwwwwwwwwwwwwwwyyk",
  ".kkkkkkRRRRRRRkkkkkkk.",
  "......kRRRRRRRRk......",
  ".......kkkkkkkkk......",
  "..........kgk.........",
  "..........kkk.........",
].map((row, i) => (prop === 0 ? (i >= 2 && i <= 12 ? row.slice(0, 21) + "G" : row) : i >= 6 && i <= 9 ? row.slice(0, 21) + "G" : row));

const S = {
  plane: [plane(0), plane(1)],

  paper: [[
    "................",
    "..............k.",
    "............kkwk",
    "..........kkwwwk",
    "........kkwwwwk.",
    "......kkwwwwwlk.",
    "....kkwwwwwwllk.",
    "..kkwwwwwwwlllk.",
    ".kwwwwwwwwssllk.",
    "..kkkkssswsslk..",
    "......kssswslk..",
    ".......ksswslk..",
    "........kswlk...",
    ".........kslk...",
    "..........kk....",
    "................",
  ]],

  roll: [[
    "......yyyy......",
    "....yy....yy....",
    "...y........y...",
    "..y..kkkkkkk..y.",
    "..y..kOOOOOk...y",
    "....kkkkkkkkk...",
    ".kkkooooobbook..",
    "kooooooooooooyk.",
    ".kkkooooooookk..",
    "....kkkkkkkkk...",
    ".y...kOOOOOk..y.",
    ".y...kkkkkkk..y.",
    "..y..........y..",
    "...yy......yy...",
    ".....yyyyyy.....",
    "................",
  ]],

  flyer: [[
    "................",
    "................",
    "........kk......",
    ".kk.....kGk.....",
    ".kGk....kGGk....",
    ".kwGk...kGGGk...",
    ".kwwwkkkkkkkkkk.",
    "kwwwwwbwbwbwbwwk",
    "kwwwwwwwwwwwwwbk",
    ".kkkkkkkkkkkwwk.",
    "......kGGGkkkk..",
    ".....kGGGk......",
    ".....kGGk.......",
    ".....kkk........",
    "................",
    "................",
  ]],

  jet: [[
    "................",
    "......kk........",
    "......kBk.......",
    "......kBBk......",
    ".kk...kBBBk.....",
    ".kBk..kkkkkkk...",
    ".kBBkkllllbbbkk.",
    "yokllllllllllllk",
    "yokllllllllllkk.",
    ".kBBkkkkkkkkk...",
    ".kBk..kBBBk.....",
    ".kk...kBBk......",
    "......kBk.......",
    "......kk........",
    "................",
    "................",
  ]],

  deep: [
    [
      ".......kk.......",
      "......krrk......",
      ".....krrrrk.....",
      ".....kllllk.....",
      "....kllbbllk....",
      "....klbBBblk....",
      "....kllbbllk....",
      "....kllllllk....",
      "....kllllllk....",
      "...kkllllllkk...",
      "..krkllllllkrk..",
      "..krrkkkkkkrrk..",
      "..kkk.yooy.kkk..",
      "......yooy......",
      ".......yy.......",
      ".......y........",
    ],
    [
      ".......kk.......",
      "......krrk......",
      ".....krrrrk.....",
      ".....kllllk.....",
      "....kllbbllk....",
      "....klbBBblk....",
      "....kllbbllk....",
      "....kllllllk....",
      "....kllllllk....",
      "...kkllllllkk...",
      "..krkllllllkrk..",
      "..krrkkkkkkrrk..",
      "..kkkyooooykkk..",
      ".....yoYYoy.....",
      "......yooy......",
      "......y..y......",
    ],
  ],

  skyllion: [
    [
      "................",
      ".......kk.......",
      ".......yk.......",
      "......kyyk......",
      "......kyYk......",
      ".....kyYYyk.....",
      ".kkkkkyYYYykkkk.",
      "kyyyyyYYwYYyyyyk",
      ".kkkkkyYYYykkkk.",
      ".....kyYYyk.....",
      "......kyYk......",
      "......kyyk......",
      ".......yk.......",
      ".......kk.......",
      "................",
      "................",
    ],
    [
      "..Y.............",
      ".YwY...kk.......",
      "..Y....yk.......",
      "......kyyk......",
      "......kyYk...Y..",
      ".....kyYYyk.....",
      ".kkkkkyYYYykkkk.",
      "kyyyyyYYwYYyyyyk",
      ".kkkkkyYYYykkkk.",
      ".....kyYYyk.....",
      "......kyYk......",
      "..Y...kyyk......",
      ".......yk....Y..",
      ".......kk...YwY.",
      ".............Y..",
      "................",
    ],
  ],

  grounded: [
    [
      "................",
      ".....kkkk.......",
      "...kkGGGGkkk....",
      "..kGGGGGGGGGkk..",
      ".kGGGdGGGGGGGGk.",
      "kGGGGGGGGGdGGGGk",
      "kGGdGGGGGGGGGGGk",
      ".kkkkkkkkkkkkkk.",
      "...b.....y......",
      "....b...yy...b..",
      "..b.....y.....b.",
      "...b...y...b....",
      "........y...b...",
      "..b.............",
      "................",
      "................",
    ],
    [
      "................",
      ".....kkkk.......",
      "...kkGGGGkkk....",
      "..kGGGGGGGGGkk..",
      ".kGGGdGGGGGGGGk.",
      "kGGGGGGGGGdGGGGk",
      "kGGdGGGGGGGGGGGk",
      ".kkkkkkkkkkkkkk.",
      "..b.........b...",
      "...b.....b...b..",
      ".......b........",
      "..b.....b...b...",
      "...b.........b..",
      "........b.......",
      "................",
      "................",
    ],
  ],

  cloud: [[
    "..........llll..................",
    "........llwwwwll......llll......",
    ".......lwwwwwwwwl...llwwwwll....",
    "......lwwwwwwwwwwlllwwwwwwwwl...",
    "....lllwwwwwwwwwwwwwwwwwwwwwwl..",
    "..llwwwwwwwwwwwwwwwwwwwwwwwwwwl.",
    ".lwwwwwwwwwwwwwwwwwwwwwwwwwwwwwl",
    "lwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwl",
    "lsswwwwwwwwwwwwwwwwwwwwwwwwwwssl",
    ".lssssswwwwwwwwwwwwwwwwwwsssssl.",
    "..lllssssssssssssssssssssslll...",
    ".....lllllllllllllllllllll......",
  ]],

  cloudlet: [[
    "....llll........",
    "..llwwwwll.lll..",
    ".lwwwwwwwwlwwwl.",
    "lwwwwwwwwwwwwwwl",
    "lsswwwwwwwwwwssl",
    ".llssssssssssll.",
    "...llllllllll...",
  ]],

  bird: [
    [
      "k......k",
      ".k....k.",
      "..kkkk..",
      "........",
    ],
    [
      "........",
      "..kkkk..",
      ".k....k.",
      "k......k",
    ],
  ],

  balloon: [[
    "....kkkkkk....",
    "..kkrryyrrkk..",
    ".krrryyyyrrrk.",
    "krrrryyyyrrrrk",
    "krrrryyyyrrrrk",
    "krrrryyyyrrrrk",
    ".krrryyyyrrrk.",
    "..krryyyyrrk..",
    "...kkryyrkk...",
    "....k.kk.k....",
    "....k....k....",
    "....kOOOOk....",
    "....kOOOOk....",
    ".....kkkk.....",
  ]],

  airliner: [[
    "...............kk.......",
    "kk.............klk......",
    "klk.......kkkkkkklkkkk..",
    "kllkkkkkkkllllllllllllk.",
    "kllllbllbllbllbllbllbllk",
    ".kkkkkkkkkkkkkklllllllk.",
    "..........kllk.kkkkkkk..",
    "..........kkk...........",
  ]],

  wballoon: [[
    "..kkkk..",
    ".kwwwwk.",
    "kwwwwlwk",
    "kwwwwlwk",
    "kwwwlwwk",
    ".kwwwwk.",
    "..kkkk..",
    "...k....",
    "....k...",
    "...k....",
    "..kOOk..",
    "..kbbk..",
    "..kkkk..",
  ]],

  meteor: [[
    "........kkkk",
    "....yy.kooOk",
    "..yyYYkoyooOk",
    "yyYYwwkooyook",
    "..yyYYkoooOk",
    "....yy.kkkk.",
  ].map((r) => r.padEnd(13, ".").slice(0, 13))],

  satellite: [[
    "................",
    "kkkkk......kkkkk",
    "kBnBk......kBnBk",
    "kBnBkkkkkkkkBnBk",
    "kBnBkkgggkkkBnBk",
    "kBnBk.kglk..kBnBk",
    "kBnBk.kggk..kBnBk",
    "kkkkk..kk...kkkkk",
    ".......kk.......",
    "......kwwk......",
  ].map((r) => r.slice(0, 16))],

  iss: [[
    "kkkk.kkkk..........kkkk.kkkk",
    "kBnk.kBnk..........kBnk.kBnk",
    "kBnk.kBnk...kkkk...kBnk.kBnk",
    "kBnkkkkkkkkkkllkkkkkkkkkkBnk",
    "kBnkgggggggggllggggggggggBnk",
    "kBnkkkkkkkkkkllkkkkkkkkkkBnk",
    "kBnk.kBnk...kkkk...kBnk.kBnk",
    "kBnk.kBnk..........kBnk.kBnk",
    "kkkk.kkkk..........kkkk.kkkk",
  ]],

  moon: [[
    "........kkkkkkkk........",
    "......kkllllllllkk......",
    "....kklllllllllllkk.....",
    "...klllgglllllllllllk...",
    "..klllgggllllllllllllk..",
    "..kllllgglllllllggllllk.",
    ".klllllllllllllgggglllk.",
    ".kllllllllllllllgglllllk",
    "kllllllllllllllllllllllk",
    "klllllllglllllllllllllsk",
    "kllllllggglllllllllllssk",
    "kllllllgglllllllllllsssk",
    "kllllllllllllllggllllssk",
    "klllllllllllllgggglllssk",
    ".kllllllllllllggglllssk.",
    ".klllllllllllllllllsssk.",
    "..kllllgglllllllllsssk..",
    "..klllggggllllllssssk...",
    "...klllgglllllsssssk....",
    "....kklllllllsssskk.....",
    "......kkssssssskk.......",
    "........kkkkkkk.........",
  ]],

  planet: [[
    "..............kk........",
    ".........kkkkkpk........",
    ".......kkppppPkpk.......",
    "kk...kkppppppPPkpk......",
    "kykkkpppPPpppppPkyk.....",
    ".kyyyykppppPPpppkyyk....",
    "..kkyyyyyyyyyyyyyyyykk..",
    "....kkkPppppyyyyyyyyyyk.",
    "......kpPPpppppPkkkkkyyk",
    "......kkpppppPPpk....kk.",
    "........kkpppppk........",
    "..........kkkkk.........",
  ]],

  ufo: [
    [
      "......kkkk......",
      ".....kbbbbk.....",
      "....kbwbbbbk....",
      "..kkkkkkkkkkkk..",
      ".kggggggggggggk.",
      "kgyggrggyggrggyk",
      ".kkggggggggggkk.",
      "...kkkkkkkkkk...",
      "....b..b..b.....",
    ],
    [
      "......kkkk......",
      ".....kbbbbk.....",
      "....kbwbbbbk....",
      "..kkkkkkkkkkkk..",
      ".kggggggggggggk.",
      "kgrggyggrggyggrk",
      ".kkggggggggggkk.",
      "...kkkkkkkkkk...",
      ".....b..b..b....",
    ],
  ],

  tower: [[
    "..kkkkkkkk..",
    ".kbbbbbbbbk.",
    "kbwbbbbbbbbk",
    "kkkkkkkkkkkk",
    ".kggggggggk.",
    "..kglgggk...",
    "..kggggk....",
    "..kgglgk....",
    "..kggggk....",
    "..kglggk....",
    "..kggggk....",
    "..kgggrk....",
    "..kggggk....",
    "..kglggk....",
    "..kggggk....",
    ".kkkkkkkk...",
  ].map((r) => r.padEnd(12, "."))],

  // ---- Dogfight mystery box + power-ups ----
  mbox: (() => {
    const inner = ["YYYYYYYYYYYY", "YyyyyyyyyyyO", "YyyywwwwyyyO", "YyywwyywwyyO", "YyyyyyywwyyO", "YyyyyywwyyyO", "YyyyywwyyyyO", "YyyyywwyyyyO", "YyyyyyyyyyyO", "YyyyywwyyyyO", "YyyyyyyyyyyO", "OOOOOOOOOOOO"];
    const f = ["................", ".kkkkkkkkkkkkkk.", ...inner.map((r) => `.k${r}k.`), ".kkkkkkkkkkkkkk.", "................"];
    return [f, f.map((r) => r.replace(/w/g, "b"))];
  })(),
  missile: [[
    "................", "................", "................", "................",
    "..kkk...........", "..krrk..........", "kkkkkkkkkkkkk...",
    "Yokllllllllllrk.", "yokllllllllllrrk", "Yokllllllllllrk.",
    "kkkkkkkkkkkkk...", "..krrk..........", "..kkk...........",
    "................", "................", "................",
  ]],
  bolt: (() => {
    const f = [
      "................", "....kkkkk.......", "..kkddddkkkk....", ".kdddGdddddkk...", "kddddddddGddddk.", "kddddddddddddk..",
      ".kkkkykkkkkkk...", "....yy..........", "...yy...........", "..yyyyy.........", "....yy..........", "...yy...........",
      "..yy............", "..y.............", "................", "................",
    ];
    return [f, f.map((r) => r.replace(/y/g, "Y"))];
  })(),
  wind: (() => {
    const f = [
      "................", "................", "......bbbbb.....", ".....b.....b....", "...........b....", "bbbbbbbbbbb.....",
      "................", "..bbbbbbbbbbbb..", "................", "bbbbbbbbbb......", "..........b.....", ".....b....b.....",
      "......bbbb......", "................", "................", "................",
    ];
    return [f, f.map((r) => r.replace(/b/g, "w"))];
  })(),
  shield: [[
    "................", "...kkkkkkkkkk...", "..kbbbbbbbbbBk..", "..kbwwbbbbbbBk..", "..kbwbbbbbbbBk..", "..kbbbbbbbbbBk..",
    "..kbbbbbbbbbBk..", "..kbbbbbbbbbBk..", "...kbbbbbbbBk...", "...kbbbbbbbBk...", "....kbbbbbBk....", ".....kbbbBk.....",
    "......kbBk......", ".......kk.......", "................", "................",
  ]],
  slip: [[
    "................", ".......kk.......", "......keek......", ".....keEEek.....", "....keEkkEek....", "...keEk..kEek...",
    "...kkk....kkk...", ".......kk.......", "......keek......", ".....keEEek.....", "....keEkkEek....", "...keEk..kEek...",
    "...kkk....kkk...", "................", "................", "................",
  ]],
  fog: [[
    "................", "................", "................", ".....llll.......", "...llssssll.....", "..lssssssssl.ll.",
    ".lsssssssssssssl", "lssssssssssssssl", "lssgsssssssgsssl", ".lsssssssssssssl", "..llllllllllllll", "...g..g...g.....",
    "................", "................", "................", "................",
  ]],
  boom: (() => {
    const f = [
      "................", "......y.........", "..y..yoy...y....", "...yyoooy.yy....", "..yoorrrooy.....", ".yoorRRRrroy....",
      "yyorRwwRrooyy...", ".yorRwwRRroy....", "..yorRRRroy.....", "...yoorooy.y....", "..y..yyy..y.....", "......y.........",
      "................", "................", "................", "................",
    ];
    return [f, f.map((r) => r.replace(/r/g, "o").replace(/R/g, "r").replace(/w/g, "Y"))];
  })(),

  sparkle: [[
    "..Y..",
    "..Y..",
    "YYwYY",
    "..Y..",
    "..Y..",
  ]],
};

// ---------------- PNG encoding ----------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function png(w, h, px /* (x,y)=>[r,g,b,a] */) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const rgba = (ch) => {
  if (ch === "." || ch === undefined) return [0, 0, 0, 0];
  const hex = PAL[ch];
  if (!hex) throw new Error(`unknown palette key "${ch}"`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
};

// ---------------- write ----------------
const out = new URL("../public/px/", import.meta.url);
mkdirSync(out, { recursive: true });
const manifest = {};
for (const [name, frames] of Object.entries(S)) {
  const h = frames[0].length, w = Math.max(...frames.flat().map((r) => r.length));
  for (const f of frames) if (f.length !== h) throw new Error(`${name}: frame heights differ`);
  writeFileSync(new URL(`${name}.png`, out), png(w * frames.length, h, (x, y) => rgba(frames[Math.floor(x / w)][y][x % w])));
  manifest[name] = { w, h, frames: frames.length };
}
writeFileSync(new URL("../lib/px.json", import.meta.url), JSON.stringify(manifest, null, 0) + "\n");
console.log(`${Object.keys(S).length} sprites -> public/px/`);

// Optional contact sheet (all frames, 6x, on a mid-blue background) for checking the art by eye.
if (process.argv[2]) {
  const Z = 6, pad = 4, items = Object.entries(S).flatMap(([, fr]) => fr);
  const W = items.reduce((s, f) => s + (Math.max(...f.map((r) => r.length)) + pad), pad) ;
  const H = Math.max(...items.map((f) => f.length)) + pad * 2;
  const cols = [];
  let x0 = pad;
  for (const f of items) { cols.push([x0, f]); x0 += Math.max(...f.map((r) => r.length)) + pad; }
  writeFileSync(process.argv[2], png(W * Z, H * Z, (X, Y) => {
    const x = Math.floor(X / Z), y = Math.floor(Y / Z) - pad;
    for (const [cx, f] of cols) if (x >= cx && x < cx + 40 && f[y] && x - cx < f[y].length) { const c = rgba(f[y][x - cx]); if (c[3]) return c; }
    return [70, 120, 190, 255];
  }));
}

// Favicon (app/icon.png, 48x48) and a big nearest-neighbour mascot for the README.
const up = (name, z, W, H) => {
  const f = S[name][0], w = f[0].length, h = f.length, ox = Math.floor((W - w * z) / 2), oy = Math.floor((H - h * z) / 2);
  return png(W, H, (x, y) => { const fx = Math.floor((x - ox) / z), fy = Math.floor((y - oy) / z); return fx >= 0 && fy >= 0 && fx < w && fy < h ? rgba(f[fy][fx]) : [0, 0, 0, 0]; });
};
writeFileSync(new URL("../app/icon.png", import.meta.url), up("plane", 2, 48, 48));
writeFileSync(new URL("plane-8x.png", out), up("plane", 8, 22 * 8, 14 * 8));
