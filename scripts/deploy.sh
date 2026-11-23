#!/usr/bin/env bash
# Build with .env.local and publish dist/ to the gh-pages branch (GitHub Pages serves it at /pocket/).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
cd dist
touch .nojekyll
git init -q
git checkout -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "Deployed: https://derick-liew.github.io/pocket/"
