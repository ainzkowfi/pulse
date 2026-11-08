# pulse — AGENTS.md

Personal opencode agent repo. `agent/pulse.md` is the agent; `README.md` is the install/update truth. This file holds traps only — no duplicated commands.

## Truths

- Agent install is a symlink `~/.config/opencode/agents/pulse.md` → this repo. Pull = live agent change.
- `plugins/ponytail.ts` is a V2 port; `plugins/casually.ts` is an original V2 style plugin. Published packages aren't used for them.
- `agent/pulse.md` and `agent/reviewer.md` use V2 `permissions:` lists, not the V1 `permission` object/`bash` key. Do not "fix" them to V1 syntax.
- `permissions` is ordered; later rules win. Broad rules go first, exceptions after. V2 base policy keeps `.env` reads ask-by-default; `pulse.md` and `reviewer.md` use `ask` for formerly hard denies (push, env edits, reviewer edit/shell). Keep allow rules untouched.
- OpenCode shell checks may reject compound/dynamic commands (`sh -c`, backticks, nested quotes). Split them or use dedicated read/edit/glob/grep tools; don't fight the scanner.
- `config/dcp.jsonc` is the DCP plugin config. README says opencode restart is required after changing it.
- DCP `minContextLimit` is deliberately `90%` to suppress unresolved nudge spam (issue #662); don't lower it unless the DCP nudge bug is fixed upstream.
- `.pulse/` is local private memory and gitignored. Never commit it.
- `rosetta` (RouterOS docs MCP) is a user-level install, not a repo file: bun at `~/.bun/bin`, ~400MB DB at `~/.rosetta`, config in `~/.config/opencode/opencode.json`. Its bin shebang needs `bun` on PATH, so the MCP entry sets `PATH` explicitly. README owns install; don't add it to `package.json` files.
- Device connection profiles live at `.pulse/memory/devices/<name>.md` (gitignored). They store method/host/port/user/key path and a credential *reference* only. Raw passwords/keys never go in memory files, templates, or any tracked file.
- The bundled RouterOS skill and its install path are part of the repo/README. Keep README, `scripts/check.sh`, and this file in sync. `routeros-scripting` is a required external skill (`tikoci/routeros-skills@routeros-scripting`, lands in `~/.agents/skills/`); README owns its install and `check.sh` enforces the `pulse.md` branch.
- The skills installed by the README's mattpocock npx commands are copies in `~/.config/opencode/skills/`. They are not tracked by this repo and do not auto-update.
- `agent/reviewer.md` is a visible read-only reviewer subagent (V2 `permissions` list denies edit/shell, allows `git diff|log|show`). If you change its mode or permissions, update README and verify with `bash scripts/check.sh`.
- No build/test suite. Verification is manual: `opencode plugin list`, `opencode api get /api/skill --param 'location[directory]=$PWD'`, `opencode api get /api/agent`, and `bash scripts/check.sh`.

## Editing rules

- Load the `writing-for-agents` skill before editing `agent/pulse.md`, any skill, or this file.
- Keep one source of truth per fact: README = install + user-facing overview, `pulse.md` = exact agent behaviour, this file = traps. If install steps change, update all three that apply; user-facing behaviour summaries live only as short README overview bullets, not full rule duplication.
- Prefer symlinks into `~/.config/opencode/` for repo-owned agent/plugin/config files. Regular copies go stale silently.
- `improve-codebase-architecture` is a global skill, not this repo; it was adapted to Pulse (no grilling/domain-modeling calls). Don't duplicate that adaptation here.
