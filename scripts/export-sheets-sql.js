"use strict";

/**
 * 把本機 data/sheets.db 的樂譜與書籤匯出成 SQL，供 D1 匯入：
 *   node scripts/export-sheets-sql.js
 *   npx wrangler d1 execute guitar-sheets --remote --file cloudflare/seed.sql
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = process.env.SHEETS_DB || path.join(root, "data", "sheets.db");
const outPath = path.join(root, "cloudflare", "seed.sql");

if (!fs.existsSync(dbPath)) {
  console.error(`找不到資料庫：${dbPath}`);
  process.exit(1);
}

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

const db = new Database(dbPath, { readonly: true });
const sheets = db.prepare("SELECT * FROM sheets ORDER BY filename").all();
const bookmarks = db.prepare("SELECT filename FROM bookmarks ORDER BY filename").all();

const lines = ["DELETE FROM sheets;", "DELETE FROM bookmarks;", ""];

for (const row of sheets) {
  lines.push(
    "INSERT INTO sheets (filename, title, artist, \"key\", bpm, capo, tags, image, content, last_modified, added_date, size) VALUES (" +
      [
        row.filename,
        row.title,
        row.artist,
        row.key,
        row.bpm,
        row.capo,
        row.tags,
        row.image,
        row.content,
        row.last_modified,
        row.added_date,
        row.size,
      ]
        .map(quote)
        .join(", ") +
      ");"
  );
}

for (const row of bookmarks) {
  lines.push(`INSERT INTO bookmarks (filename) VALUES (${quote(row.filename)});`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
db.close();

console.log(`已匯出 ${sheets.length} 首樂譜、${bookmarks.length} 個書籤 → ${path.relative(root, outPath)}`);
