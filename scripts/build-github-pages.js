"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, ".pages-dist");

const COPY_FILES = [
  "index.html",
  "reader.html",
  "editor.html",
  "styles.css",
  "chords.json",
  "manifest.webmanifest",
];

const COPY_DIRS = ["assets", "fonts", "examples"];
const MODULE_EXCLUDES = new Set(["server", "server.js"]);

function copyFile(srcRel) {
  const src = path.join(root, srcRel);
  if (!fs.existsSync(src)) {
    console.warn("找不到 " + srcRel + "，跳過");
    return;
  }
  const dest = path.join(out, srcRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, excludes) {
  if (!fs.existsSync(src)) {
    console.warn("找不到 " + path.relative(root, src) + "，跳過");
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (excludes && excludes.has(entry)) continue;
    const from = path.join(src, entry);
    const to = path.join(dest, entry);
    if (fs.statSync(from).isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

COPY_FILES.forEach(copyFile);
COPY_DIRS.forEach((dir) => copyDir(path.join(root, dir), path.join(out, dir)));
copyDir(path.join(root, "modules"), path.join(out, "modules"), MODULE_EXCLUDES);

fs.writeFileSync(path.join(out, ".nojekyll"), "");
fs.writeFileSync(
  path.join(out, "404.html"),
  `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>u-chord</title>
  <script>
    (function () {
      var segs = location.pathname.split("/").filter(Boolean);
      var base = "/";
      if (/\\.github\\.io$/i.test(location.hostname) && segs[0]) {
        base = "/" + segs[0] + "/";
      }
      location.replace(base);
    })();
  </script>
</head>
<body></body>
</html>
`
);

console.log("GitHub Pages 靜態檔已輸出至 .pages-dist");
