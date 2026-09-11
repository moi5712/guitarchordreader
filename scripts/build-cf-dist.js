"use strict";

/**
 * 收集 Cloudflare Worker 要提供的靜態檔案到 .cf-dist。
 * 只挑前端會用到的資源，伺服器端程式碼不上傳。
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, ".cf-dist");

const FILES = [
  "index.html",
  "reader.html",
  "editor.html",
  "styles.css",
  "chords.json",
  "manifest.webmanifest",
  // fonts/ 內其餘字型沒有被 styles.css 引用，每個約 3.5MB，不上傳
  "fonts/ZenMaruGothic-Medium.ttf",
];

const DIRS = ["assets"];

// 伺服器端模組不需要送到瀏覽器
const MODULE_EXCLUDES = new Set(["server", "server.js", "importer"]);

function copyFile(relPath) {
  const src = path.join(root, relPath);
  if (!fs.existsSync(src)) {
    console.warn(`找不到 ${relPath}，跳過`);
    return;
  }
  const dest = path.join(out, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, excludes) {
  if (!fs.existsSync(src)) {
    console.warn(`找不到 ${path.relative(root, src)}，跳過`);
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

FILES.forEach(copyFile);
DIRS.forEach((dir) => copyDir(path.join(root, dir), path.join(out, dir)));
copyDir(path.join(root, "modules"), path.join(out, "modules"), MODULE_EXCLUDES);

console.log("靜態檔已輸出至 .cf-dist");
