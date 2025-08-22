#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const docsDir = path.resolve(__dirname, '..', 'docs');
const pagesDir = path.resolve(docsDir, 'pages');
const indexPath = path.join(docsDir, 'index.html');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

if (!fs.existsSync(indexPath)) {
  console.error('docs/index.html not found — run the build first.');
  process.exit(0);
}

const pageFiles = walk(pagesDir);
if (pageFiles.length === 0) {
  console.log('No pages found in', pagesDir);
  process.exit(0);
}

pageFiles.forEach((filePath) => {
  const rel = path.relative(pagesDir, filePath); // e.g. about.html or blog/post1.html
  const destPath = path.join(docsDir, rel);
  const destDir = path.dirname(destPath);
  try {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(indexPath, destPath);
    console.log('Created', destPath);
  } catch (err) {
    console.error('Failed to create', destPath, err);
  }
});

console.log('SPA route files generated.');
