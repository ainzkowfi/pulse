# pulse — AGENTS.md

Personal opencode agent repo. `agent/pulse.md` is the agent; `README.md` is the install/update truth. This file holds traps only — no duplicated commands.

## Truths

- Agent install is a symlink `~/.config/opencode/agents/pulse.md` → this repo. Pull = live agent change.
- `plugins/caveman.ts` and `plugins/ponytail.ts` are V2 ports. The published packages still target the V1 plugin API and fail to load in V2. Don't "simplify" them back to npm packages.
- `agent/pulse.md` and `agent/reviewer.md` use V2 `permissions:` lists, not the V1 `permission` object/`bash` key. Do not "fix" them to V1 syntax.
- `permissions` is ordered; later rules win. Broad rules go first, exceptions after. V2 base policy keeps `.env` reads ask-by-default; `pulse.md` denies editing `*.env*` except `.env.example`.
- `config/dcp.jsonc` is the DCP plugin config. README says opencode restart is required after changing it (unlike agent/memory edits, which watch/reload).
- `.pulse/` is local private memory and gitignored. Never commit it.
- The bundled RouterOS skill and its install path are part of the npm package (`skills/routeros-network-ops/`) and the README. Keep README, `package.json` `files`, and this file in sync.
- The skills installed by the README's mattpocock npx commands are copies in `~/.config/opencode/skills/`. They are not tracked by this repo and do not auto-update.
- `agent/reviewer.md` is a visible read-only reviewer subagent (V2 `permissions` list denies edit/shell, allows `git diff|log|show`). If you change its mode or permissions, update README and verify with `bash scripts/check.sh`.
- No build/test suite. Verification is manual: `opencode plugin list`, `opencode api get /api/skill --param 'location[directory]=$PWD'`, `opencode api get /api/agent`, and `bash scripts/check.sh`.

## Editing rules

- Load the `writing-for-agents` skill before editing `agent/pulse.md`, any skill, or this file.
- Keep one source of truth per fact: README = install + user-facing overview, `pulse.md` = exact agent behaviour, this file = traps. If install steps change, update all three that apply; user-facing behaviour summaries live only as short README overview bullets, not full rule duplication.
- Prefer symlinks into `~/.config/opencode/` for repo-owned agent/plugin/config files. Regular copies go stale silently.
- `improve-codebase-architecture` is a global skill, not this repo; it was adapted to Pulse (no grilling/domain-modeling calls). Don't duplicate that adaptation here.
