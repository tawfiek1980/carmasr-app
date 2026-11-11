import fs from "node:fs";

const INVIS = /[\u200B-\u200F\u202A-\u202E\u061C\u0640\u2066-\u2069]/;
const files = process.argv.slice(2);

for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((l, i) => {
    const m = l.match(INVIS);
    if (m) {
      const idx = l.indexOf(m[0]);
      console.log(`${f}:${i + 1}  U+${m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}  ...${l.slice(Math.max(0, idx - 25), idx + 25)}...`);
    }
  });
}