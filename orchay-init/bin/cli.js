#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TEMPLATES = path.join(__dirname, '..', 'templates');

function main() {
  const args = process.argv.slice(2);

  // --help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: orchay-init [destination]

Initialize orchay project structure with .claude and .orchay folders.

Arguments:
  destination    Target directory (default: current directory)

Examples:
  npx orchay-init           # Initialize in current directory
  npx orchay-init ./myapp   # Initialize in ./myapp
`);
    process.exit(0);
  }

  const dest = path.resolve(args[0] || '.');

  // 대상 폴더 생성
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
    console.log(`Created: ${dest}`);
  }

  // templates 폴더 확인
  if (!fs.existsSync(TEMPLATES)) {
    console.error('Error: templates folder not found.');
    console.error('Run "npm run build" first if developing locally.');
    process.exit(1);
  }

  console.log('Initializing orchay project structure...\n');

  let copied = 0;

  // .claude 폴더 복사
  const claudeSrc = path.join(TEMPLATES, '.claude');
  if (fs.existsSync(claudeSrc)) {
    const claudeDest = path.join(dest, '.claude');
    fs.cpSync(claudeSrc, claudeDest, { recursive: true, force: true });
    console.log('  .claude/ copied');
    copied++;
  }

  // .orchay 폴더 복사
  const orchaySrc = path.join(TEMPLATES, '.orchay');
  if (fs.existsSync(orchaySrc)) {
    const orchayDest = path.join(dest, '.orchay');
    fs.cpSync(orchaySrc, orchayDest, { recursive: true, force: true });
    console.log('  .orchay/ copied');
    copied++;

    // projects 폴더 생성 (빈 폴더)
    const projectsDir = path.join(orchayDest, 'projects');
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
      console.log('  .orchay/projects/ created');
    }
  }

  if (copied > 0) {
    console.log(`\nDone! Project initialized at: ${dest}`);
  } else {
    console.error('\nError: No template files found in package.');
    process.exit(1);
  }
}

main();
