import fs from "node:fs";

const targets = [
  "scripts/build-video.mjs",
  "videos/script.md",
  "src/components/SplashScreen.tsx",
  "src/pages/ListingDetail.tsx",
  "src/contexts/AuthContext.tsx",
  "src/services/devicePush.ts",
  "src/components/PushSetup.tsx",
];

const AR = /[\u0600-\u06FF]/;
const LA = /[A-Za-z]/;
const INVIS = /[\u200B-\u200F\u202A-\u202E\u061C\u0640\u2066-\u2069]/;
const CJK = /[\u3000-\u9FFF\uFF00-\uFFEF]/;
const SPLIT = /[\s\\(){}'",:;|\[\]]+/;

let problems = 0;

for (const f of targets) {
  if (!fs.existsSync(f)) { console.log("(missing) " + f); continue; }
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (!AR.test(l)) return;
    if (INVIS.test(l)) {
      problems++;
      console.log("INVISIBLE  " + f + ":" + (i + 1) + "  " + JSON.stringify(l.trim().slice(0, 90)));
    }
    if (CJK.test(l)) {
      problems++;
      console.log("CJK        " + f + ":" + (i + 1) + "  " + JSON.stringify(l.trim().slice(0, 90)));
    }
    for (const tok of l.split(SPLIT)) {
      if (AR.test(tok) && LA.test(tok)) {
        problems++;
        console.log("MIXED      " + f + ":" + (i + 1) + "  <" + tok + ">");
      }
    }
  });
}

console.log(problems ? "\n>>> " + problems + " مشكلة" : "\n>>> نضيف: مفيش حروف غريبة ولا خلط لغوي");