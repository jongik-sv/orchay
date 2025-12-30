#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARENT = path.resolve(ROOT, '..');
const TEMPLATES = path.join(ROOT, 'templates');

// 복사할 소스 경로들
const SOURCES = {
  '.claude': ['agents', 'commands', 'includes'],
  '.orchay': ['script', 'settings', 'templates']
};

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  Skip (not found): ${src}`);
    return false;
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`  Copied: ${path.relative(PARENT, src)} -> ${path.relative(ROOT, dest)}`);
  return true;
}

function build() {
  console.log('Building orchay-init templates...\n');

  // templates 폴더 초기화
  if (fs.existsSync(TEMPLATES)) {
    fs.rmSync(TEMPLATES, { recursive: true });
  }
  fs.mkdirSync(TEMPLATES, { recursive: true });

  let totalCopied = 0;

  // 각 소스 폴더 복사
  for (const [folder, subdirs] of Object.entries(SOURCES)) {
    const destFolder = path.join(TEMPLATES, folder);
    fs.mkdirSync(destFolder, { recursive: true });

    for (const subdir of subdirs) {
      const src = path.join(PARENT, folder, subdir);
      const dest = path.join(destFolder, subdir);
      if (copyDir(src, dest)) {
        totalCopied++;
      }
    }
  }

  console.log(`\nBuild complete! (${totalCopied} folders copied)`);
}

build();
