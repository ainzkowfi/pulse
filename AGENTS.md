# pulse — AGENTS.md

Personal opencode agent repo. `agent/pulse.md` is the agent; `README.md` is the install/update truth. This file holds traps only — no duplicated commands.

## Truths

- Agent install is a symlink `~/.config/opencode/agents/pulse.md` → this repo. Pull = live agent change.
- `plugins/caveman.ts` and `plugins/ponytail.ts` are V2 ports. The published packages still target the V1 plugin API and fail to load in V2. Don't "simplify" them back to npm packages.
- `config/dcp.jsonc` is the DCP plugin config. README says opencode restart is required after changing it (unlike agent/memory edits, which watch/reload).
- `.pulse/` is local private memory and gitignored. Never commit it.
- The skills installed by the README's mattpocock npx commands are copies in `~/.config/opencode/skills/`. They are not tracked by this repo and do not auto-update.
- No test suite. Verification is manual: `opencode plugin list`, `opencode api get /api/skill --param 'location[directory]=$PWD'`, and agent presence in `/api/agent`.

## Editing rules

- Load the `writing-for-agents` skill before editing `agent/pulse.md`, any skill, or this file.
- Keep one source of truth per fact: README = install, `pulse.md` = agent behaviour, this file = traps. If install steps change, update all three that apply.
- Prefer symlinks into `~/.config/opencode/` for repo-owned agent/plugin/config files. Regular copies go stale silently.
- `improve-codebase-architecture` is a global skill, not this repo; it was adapted to Pulse (no grilling/domain-modeling calls). Don't duplicate that adaptation here.
