/**
 * build-android-www.js
 * 將 Web 資源複製到 www/ 目錄，供 Capacitor (Android) 使用。
 * 執行：node scripts/build-android-www.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// 需要複製的項目（相對於專案根目錄）
const COPY_TARGETS = [
  'index.html',
  'reader.html',
  'editor.html',
  'styles.css',
  'chords.json',
  'manifest.webmanifest',
  'assets',
  'fonts',
  'examples',
  'modules',
];

// modules 內要排除的子路徑（伺服器端、Electron 用不到的）
const MODULE_EXCLUDES = [
  'server',
  'server.js',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyItem(src, dest, excludes) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      if (excludes && excludes.includes(entry)) continue;
      copyItem(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 清空 www/
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
}
ensureDir(WWW);

// 複製各項目
for (const target of COPY_TARGETS) {
  const src = path.join(ROOT, target);
  const dest = path.join(WWW, target);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ 找不到 ${target}，跳過`);
    continue;
  }
  const excludes = target === 'modules' ? MODULE_EXCLUDES : null;
  copyItem(src, dest, excludes);
  console.log(`✓ 複製 ${target}`);
}

console.log('\n✅ www/ 已建立完成，可執行 npx cap sync 同步至 Android 專案。');
