import fs from "node:fs";

const s = fs.readFileSync("scripts/build-video.mjs", "utf8");
const block = s.slice(s.indexOf("const CLIPS"), s.indexOf("function probe"));

const entries = [];
const re = /title: \"([^\"]+)\",([\s\S]*?)\n  \},\n/g;
let m;
while ((m = re.exec(block))) {
  const title = m[1];
  const lines = [...m[2].matchAll(/\"([^\"]+)\"/g)].map((x) => x[1]);
  entries.push({ title, lines });
}

entries.forEach((e, i) => {
  console.log(`\n${String(i + 1).padStart(2, "0")}) ${e.title}`);
  e.lines.forEach((l) => console.log("      • " + l));
});

const extra = [...s.matchAll(/Dialogue: 0,[\s\S]*?\}\}([^\n]*)/g)].map((x) => x[1]);
console.log("\n--- كاردين البداية والنهاية ---");
extra.forEach((x) => console.log("   " + x.replace(/\\/g, "\\\\")));