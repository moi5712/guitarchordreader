'use strict';
/**
 * 將 build/icon.ico 嵌入 Windows .exe。
 * electron-builder 在 signAndEditExecutable:false 時不會呼叫 rcedit；
 * 開啟 signAndEditExecutable 又常因 winCodeSign 解壓失敗而無法打包。
 * 因此在 afterPack 用 rcedit 套件單獨嵌入圖示（不需程式碼簽章）。
 */
const path = require('path');
const fs = require('fs');
const rcedit = require('rcedit');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const productName = pkg.build?.productName || pkg.name;
const iconPath = path.join(root, 'build', 'icon.ico');

async function embedWinIcon(exePath) {
  if (process.platform !== 'win32') return;
  if (!fs.existsSync(exePath)) {
    console.warn('[embed-win-icon] 找不到 exe，略過:', exePath);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error('[embed-win-icon] 請先執行 npm run icons:build 產生 build/icon.ico');
  }

  await rcedit(exePath, { icon: iconPath });
  console.log('[embed-win-icon] 已嵌入圖示:', exePath);
}

/** electron-builder afterPack hook */
async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  await embedWinIcon(path.join(context.appOutDir, exeName));
}

module.exports = afterPack;
module.exports.default = afterPack;
module.exports.embedWinIcon = embedWinIcon;

if (require.main === module) {
  const exePath = process.argv[2] || path.join(root, 'dist', 'win-unpacked', `${productName}.exe`);
  embedWinIcon(exePath).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
