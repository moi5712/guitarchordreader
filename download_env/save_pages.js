// download_env\save_pages.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = __dirname;                                // download_env
const savedDir = path.join(root, 'saved_pages');       // 輸出資料夾
if (!fs.existsSync(savedDir)) fs.mkdirSync(savedDir, { recursive: true });

// 讀 urls.txt，允許：
// 1) <名稱 可含空白> <URL>
// 2) 只有 <URL>（名稱省略）
const listPath = path.join(root, 'urls.txt');
if (!fs.existsSync(listPath)) {
  console.error('找不到 urls.txt，請放在 download_env 裡。');
  process.exit(1);
}
const lines = fs.readFileSync(listPath, 'utf8')
  .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

// 檔名淨化（移除 Windows 不允許字元）
function sanitize(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'page';
}

// 找到 saved_pages 內目前最大的 page_###，回傳下一個編號
function nextGlobalIndex() {
  let max = 0;
  const re = /^page_(\d{3,})\.html$/i;
  for (const f of fs.readdirSync(savedDir)) {
    const m = f.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

// 取得不重複的輸出路徑（若存在則加 (2)、(3)…）
function uniquePath(baseName) {
  const ext = '.html';
  let name = sanitize(baseName);
  let out = path.join(savedDir, `${name}${ext}`);
  let n = 2;
  while (fs.existsSync(out)) {
    out = path.join(savedDir, `${name} (${n})${ext}`);
    n++;
  }
  return out;
}

// 僅 URL 情況：以遞增 page_001.html 命名（會延續既有最大號碼）
function autoNumberPath(counter) {
  const name = `page_${String(counter).padStart(3, '0')}`;
  return uniquePath(name.replace(/ \(\d+\)$/,'')); // 交由 uniquePath 處理重名
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  // 預先決定起始編號，讓「只有網址」的行會連號
  let counter = nextGlobalIndex();

  for (const line of lines) {
    // 解析：最後一段視為 URL，其餘合併為名稱；若只有一段且像 URL，就屬於「只有網址」
    const parts = line.split(/\s+/);
    let url, namePart;
    if (parts.length === 1 && /^https?:\/\//i.test(parts[0])) {
      url = parts[0];
      namePart = ''; // 沒有名稱 → 用自動編號
    } else {
      url = parts[parts.length - 1];
      namePart = parts.slice(0, -1).join(' ').trim();
    }

    if (!/^https?:\/\//i.test(url)) {
      console.warn(`略過（URL 無效）：${line}`);
      continue;
    }

    // 決定輸出路徑
    let outPath;
    if (!namePart) {
      // 沒命名 → 使用 page_001, page_002…
      outPath = autoNumberPath(counter);
      counter++; // 下一筆遞增
    } else {
      // 有命名 → 用名稱，若重名則自動加 (2)/(3)…
      outPath = uniquePath(namePart);
    }

    console.log(`下載中 → ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      // 觸發懶載（如有）
      await page.evaluate(async () => {
        await new Promise(res => {
          let y = 0;
          const step = () => {
            const h = document.documentElement.scrollHeight;
            window.scrollTo(0, y += 800);
            if (y + innerHeight >= h) return setTimeout(res, 800);
            setTimeout(step, 100);
          };
          step();
        });
      });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`完成：${outPath}`);
    } catch (e) {
      console.warn(`失敗：${url}\n原因：${e.message}`);
    }
  }

  await browser.close();
  console.log('==========================\n全部完成，請到 saved_pages 查看。\n==========================');
})();

