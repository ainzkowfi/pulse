#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

ROOT="$ROOT" node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.env.ROOT;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const pulse = fs.readFileSync(path.join(root, 'agent/pulse.md'), 'utf8');

for (const f of pkg.files) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) throw new Error(`package files missing: ${f}`);
}

for (const required of ['agent/pulse.md', 'agent/reviewer.md', 'skills/routeros-network-ops/SKILL.md', 'memory/MEMORY.global.template.md']) {
  if (!pkg.files.includes(required) && !pkg.files.includes('memory/')) {
    throw new Error(`package.json files missing ${required}`);
  }
}

for (const ref of ['agent/reviewer.md', 'skills/routeros-network-ops', 'memory/MEMORY.global.template.md']) {
  if (!readme.includes(ref)) throw new Error(`README missing ${ref}`);
}

for (const skill of ['coding-standards', 'tdd-workflow', 'api-design', 'backend/frontend-patterns', 'e2e-testing', 'security-review', 'frontend-slides', 'eval-harness', 'strategic-compact']) {
  if (!pulse.includes(skill)) throw new Error(`pulse.md skill branch missing ${skill}`);
}

console.log('check ok');
NODE
