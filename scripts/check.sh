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
const covered = (r) => pkg.files.some(f => f === r || (f.endsWith('/') && r.startsWith(f)));

for (const f of pkg.files) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) throw new Error(`package files missing: ${f}`);
}

for (const r of ['agent/pulse.md', 'agent/reviewer.md', 'skills/routeros-network-ops/SKILL.md', 'memory/MEMORY.global.template.md']) {
  if (!covered(r)) throw new Error(`package.json files missing ${r}`);
}

for (const ref of ['agent/reviewer.md', 'skills/routeros-network-ops', 'memory/MEMORY.global.template.md']) {
  if (!readme.includes(ref)) throw new Error(`README missing ${ref}`);
}

for (const skill of ['routeros-network-ops', 'routeros-scripting', 'coding-standards', 'tdd-workflow', 'api-design', 'backend/frontend-patterns', 'e2e-testing', 'security-review', 'frontend-slides', 'eval-harness', 'strategic-compact']) {
  if (!pulse.includes(skill)) throw new Error(`pulse.md skill branch missing ${skill}`);
}

for (const name of fs.readdirSync(path.join(root, 'config'))) {
  if (name.endsWith('.json')) JSON.parse(fs.readFileSync(path.join(root, 'config', name), 'utf8'));
}

console.log('check ok');
NODE

PACK_JSON="$(npm pack --dry-run --json)" PACK_ROOT="$ROOT" node <<'NODE'
const fs = require('fs');
const path = require('path');
const out = JSON.parse(process.env.PACK_JSON);
const files = (Array.isArray(out) ? out[0] : out).files.map((f) => f.path);
const pkg = JSON.parse(fs.readFileSync(path.join(process.env.PACK_ROOT, 'package.json'), 'utf8'));
for (const f of pkg.files) {
  const p = f.endsWith('/') ? f.slice(0, -1) : f;
  const ok = f.endsWith('/') ? files.some((x) => x === p || x.startsWith(`${p}/`)) : files.includes(f);
  if (!ok) throw new Error(`npm pack missing ${f}`);
}
console.log('npm pack file list ok');
NODE

node --experimental-strip-types scripts/check-plugins.mjs

# Linter fixtures: danger cases must fail, benign cases must pass.
set +e
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/bulk-remove.rsc" >/dev/null
[ $? -ne 1 ] && { echo "fixture bulk-remove.rsc should exit 1" >&2; exit 1; }
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/destructive.rsc" >/dev/null
[ $? -ne 1 ] && { echo "fixture destructive.rsc should exit 1" >&2; exit 1; }
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/concat-log.rsc" --strict >/dev/null
[ $? -ne 1 ] && { echo "fixture concat-log.rsc --strict should exit 1" >&2; exit 1; }
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/foreach-remove.rsc" --strict >/dev/null
[ $? -ne 1 ] && { echo "fixture foreach-remove.rsc --strict should exit 1" >&2; exit 1; }
set -e
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/clean.rsc" >/dev/null
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/benign-log.rsc" >/dev/null
set +e
python3 "$ROOT/skills/routeros-network-ops/scripts/lint_rsc.py" "$ROOT/skills/routeros-network-ops/scripts/fixtures/slash-add.rsc" --strict >/dev/null
[ $? -ne 1 ] && { echo "fixture slash-add.rsc --strict should exit 1" >&2; exit 1; }
set -e
echo "linter fixtures ok"
