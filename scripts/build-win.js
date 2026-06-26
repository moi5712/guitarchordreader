'use strict';
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

execSync('node scripts/generate-app-icon.js', { stdio: 'inherit', cwd: root });
const appBuilderExe = path.join(root, 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');

try {
  execSync(
    `powershell -NoProfile -Command "Unblock-File -Path '${appBuilderExe.replace(/'/g, "''")}' -ErrorAction SilentlyContinue"`,
    { stdio: 'inherit', cwd: root }
  );
} catch (_) {}

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
const builder = path.join(root, 'node_modules', '.bin', 'electron-builder.cmd');
const env = { ...process.env };

// 1. 產生免安裝目錄  2. 嵌入 exe 圖示  3. 再打包 NSIS（安裝版才會帶圖示）
execSync(`"${builder}" --win dir`, { stdio: 'inherit', cwd: root, env, shell: true });
execSync('node scripts/embed-win-icon.js', { stdio: 'inherit', cwd: root, env, shell: true });
execSync(`"${builder}" --prepackaged dist/win-unpacked --win nsis`, { stdio: 'inherit', cwd: root, env, shell: true });
