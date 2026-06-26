'use strict';
/**
 * 由 assets/favicon.svg 產生：
 * - build/icon.png（mac / 視窗、extraResources）
 * - build/icon.ico（Windows exe／工作列需多尺寸 ICO 才會正確嵌入）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets', 'favicon.svg');
const outDir = path.join(root, 'build');
const outPng = path.join(outDir, 'icon.png');
const outIco = path.join(outDir, 'icon.ico');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('找不到 SVG：', svgPath);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const resizeOpts = {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  };
  await sharp(svgPath).resize(1024, 1024, resizeOpts).png().toFile(outPng);
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svgPath).resize(size, size, resizeOpts).png().toBuffer()
    )
  );
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(outIco, icoBuffer);
  console.log('已產生應用程式圖示：', outPng);
  console.log('已產生 Windows ICO：', outIco);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
