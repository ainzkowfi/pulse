# pulse

Personal [opencode](https://opencode.ai) agent for RouterOS/MikroTik network ops, with senior web development as the secondary lane. Resolves material ambiguity before acting; low-risk work proceeds directly. Researches when unsure. Terse senior-dev output. Ponytail rules: YAGNI, shortest working diff, delete over add.

## What is Pulse?

Pulse is a personal, model-agnostic OpenCode agent built mainly for MikroTik RouterOS work — configuration, firewall/NAT, hotspot, scripting, diagnostics — with senior web development as a secondary lane. It is for work where a wrong guess is expensive and a long vibe-coded answer is useless. It is terse by design, researches when it is unsure, and fills gaps only with evidence or explicit assumptions.

What it does:

- Reads the room first: repo `AGENTS.md`, project `.pulse/memory/MEMORY.md`, and your global memory before acting. In its own repo, it fetches and reports ahead/behind before claiming up-to-date.
- Grounds RouterOS answers in versioned docs through the local `rosetta` MCP: command trees, CLI reference fields, hardware specs, and changelogs. Read-only, no router credentials.
- Carries RouterOS/network-op safety defaults: inventory device limits and capabilities first, export/backup before changes, a one-shot 5-minute rollback scheduler on the device for reachability-affecting changes, and a paste-ready revert script at the end of every state-changing response. The scheduler stays armed until you explicitly confirm the new config is stable. Records each device's connection method in `.pulse/memory/devices/` (credential reference only, never the password) and reuses it instead of guessing; `.rsc` files get linted before import.
- Resolves material ambiguity before acting; low-risk, obvious tasks proceed directly. Deep dives only when warranted.
- When it asks with options, each option says what it does/costs/changes; recommended option first.
- Researches niche or version-specific issues before answering — official docs over forums; cites its sources.
- Writes the minimum code that works: YAGNI, shortest working diff, deletion over addition, boring over clever.
- Loads relevant installed skills on demand instead of stuffing every manual into context; `verification-loop` is the only always-loaded skill. Suggests relevant local or online skills/plugins with a concrete reason and asks before installing.
- Keeps durable state in two memory tiers: `.pulse/memory/` per project and `~/.config/opencode/memory/MEMORY.md` for cross-project preferences.
- Manages long sessions with DCP pruning and a context-budget rule; saves durable facts before quality drops.
- Pushes back with evidence when a request is wrong or harms the project; proceeds only if you insist.
- Stays model-agnostic: OpenCode selects the model (`/models`, `opencode run --model ...`, or config); Pulse carries no provider-specific prompt.

What it is not:

- Not an installer with hidden side effects — wiring into OpenCode is explicit (clone + symlink, commands in this README).
- Not a push bot — you push manually; the agent commits only when told.
- Not harness-agnostic — this is for OpenCode only.
- Not provider-locked — no model is baked into the agent prompt.
- Not a yes-man — if a request is wrong or harmful, it says so.

## Layout

```
agent/pulse.md                  the agent (V2 file agent)
agent/reviewer.md               read-only reviewer subagent (visible to main agent)
skills/routeros-network-ops/    RouterOS/hotspot/ESP safety skill (bundled)
plugins/ponytail.ts             ponytail mode plugin (V2 port)
plugins/casually.ts             original always-on dry-sarcastic ultra plugin
config/dcp.jsonc                dynamic context pruning (DCP plugin) config
config/ponytail.json            ponytail defaults (full)
config/casually.json            casually config (always ultra)
memory/MEMORY.global.template.md   seed for global user memory
memory/MEMORY.project.template.md  seed for per-project memory
AGENTS.md                      repo traps; install stays in this README
package.json                   local check metadata only; `scripts/check.sh`, no published install path
```

## Install — paste this into opencode

On any machine, open a session and paste (replace `<repo-url>` with the git URL):

> Install the pulse opencode agent from `<repo-url>`:
> 1. Clone it into `~/pulse` (skip clone if it already exists).
> 2. `mkdir -p ~/.config/opencode/{agents,plugins,memory}`
> 3. Symlink `~/pulse/agent/pulse.md` → `~/.config/opencode/agents/pulse.md` and `~/pulse/agent/reviewer.md` → `~/.config/opencode/agents/reviewer.md` (if symlinks aren't supported, e.g. plain Windows, use `cp` instead and re-copy after every pull).
> 4. Install the bundled skill only if absent: `mkdir -p ~/.config/opencode/skills && ln -s ~/pulse/skills/routeros-network-ops ~/.config/opencode/skills/routeros-network-ops`.
> 5. Install required plugins only where missing; never overwrite an existing file:
>    - Symlink `~/pulse/plugins/ponytail.ts` and `~/pulse/plugins/casually.ts` into `~/.config/opencode/plugins/`.
>    - Symlink `~/pulse/config/ponytail.json`, `casually.json`, `dcp.jsonc` into `~/.config/opencode/` if absent.
>    - `opencode plugin add @tarquinen/opencode-dcp@latest` (skip if already in `opencode.json`)
> 6. Install required skills only if absent from both `~/.config/opencode/skills` and `~/.agents/skills`:
>    - `npx skills add vercel-labs/skills@find-skills -g -y`
>    - `npx skills add affaan-m/ecc@verification-loop -g -y`
>    - `npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y`
>    - `npx skills add pbakaus/impeccable@impeccable -g -y`
>    - `npx skills add tikoci/routeros-skills@routeros-scripting -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=diagnosing-bugs -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=writing-for-agents -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=retro -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=handoff -g -y`
>    - These five ship supporting files; install the full skill directories, not only `SKILL.md`.
> 7. Set `default_agent` to `"pulse"` in `~/.config/opencode/opencode.jsonc` (preserve all existing settings in the file).
> 8. If `~/.config/opencode/memory/MEMORY.md` does not exist, seed it from `~/pulse/memory/MEMORY.global.template.md`. Never overwrite an existing one.
> 9. Install the RouterOS docs MCP: `curl -fsSL https://bun.sh/install | bash`, then `"$HOME/.bun/bin/bunx" @tikoci/rosetta --setup`. Merge the `rosetta` entry from the README's “RouterOS docs MCP” section into the active OpenCode config (`opencode.json` or `opencode.jsonc`, `mcp` object; point `PATH` at `$HOME/.bun/bin`). Skip if already present.
> 10. Report what was done and what was skipped.

Per project, paste instead/also:

> Set up pulse project memory for this repo:
> 1. `mkdir -p .pulse/memory` and copy `~/pulse/memory/MEMORY.project.template.md` to `.pulse/memory/MEMORY.md` (skip copy if it already exists — never overwrite).
> 2. Ensure `.pulse/` is in `.git/info/exclude` (machine-local; do NOT append it to the tracked `.gitignore`).
> 3. Report.

No restart for agent/memory changes — opencode watches config files (`/reload` in the TUI forces it). Restart opencode after changing `dcp.jsonc`.

## Install

```sh
git clone <repo-url> ~/pulse
mkdir -p ~/.config/opencode/{agents,plugins,memory,skills}
ln -s ~/pulse/agent/pulse.md ~/.config/opencode/agents/pulse.md
ln -s ~/pulse/agent/reviewer.md ~/.config/opencode/agents/reviewer.md
[ -e ~/.config/opencode/skills/routeros-network-ops ] || ln -s ~/pulse/skills/routeros-network-ops ~/.config/opencode/skills/routeros-network-ops
# plugins/configs: only if absent
[ -e ~/.config/opencode/plugins/ponytail.ts ] || ln -s ~/pulse/plugins/ponytail.ts ~/.config/opencode/plugins/ponytail.ts
[ -e ~/.config/opencode/plugins/casually.ts ] || ln -s ~/pulse/plugins/casually.ts ~/.config/opencode/plugins/casually.ts
[ -e ~/.config/opencode/ponytail.json ] || ln -s ~/pulse/config/ponytail.json ~/.config/opencode/ponytail.json
[ -e ~/.config/opencode/casually.json ] || ln -s ~/pulse/config/casually.json ~/.config/opencode/casually.json
[ -e ~/.config/opencode/dcp.jsonc ] || ln -s ~/pulse/config/dcp.jsonc ~/.config/opencode/dcp.jsonc
opencode plugin add @tarquinen/opencode-dcp@latest
# RouterOS docs MCP (rosetta) — ~400MB DB; merge the config entry from the section below
curl -fsSL https://bun.sh/install | bash
"$HOME/.bun/bin/bunx" @tikoci/rosetta --setup
# skills: only if absent
npx skills add vercel-labs/skills@find-skills -g -y
npx skills add affaan-m/ecc@verification-loop -g -y
npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y
npx skills add pbakaus/impeccable@impeccable -g -y
npx skills add tikoci/routeros-skills@routeros-scripting -g -y
npx skills@latest add mattpocock/skills --skill=diagnosing-bugs -g -y
npx skills@latest add mattpocock/skills --skill=writing-for-agents -g -y
npx skills@latest add mattpocock/skills --skill=retro -g -y
npx skills@latest add mattpocock/skills --skill=handoff -g -y
# set "default_agent": "pulse" in ~/.config/opencode/opencode.jsonc (keep other settings)
cp ~/pulse/memory/MEMORY.global.template.md ~/.config/opencode/memory/MEMORY.md   # first machine only
```

Per project: `mkdir -p .pulse/memory && cp ~/pulse/memory/MEMORY.project.template.md .pulse/memory/MEMORY.md && echo '.pulse/' >> .git/info/exclude`

## RouterOS docs MCP — rosetta

Pulse expects [`tikoci/rosetta`](https://github.com/tikoci/rosetta) locally. It is an offline RouterOS 7 knowledge base over stdio MCP: docs, CLI reference fields, versioned command trees, hardware specs, changelogs. Full-text search, no embeddings, no API keys, no router connection.

```sh
curl -fsSL https://bun.sh/install | bash
"$HOME/.bun/bin/bunx" @tikoci/rosetta --setup   # downloads ~400MB DB to ~/.rosetta
```

Add the printed entry to `~/.config/opencode/opencode.json` (or `.jsonc`):

```json
"mcp": {
  "rosetta": {
    "type": "local",
    "command": ["/root/.bun/bin/bunx", "@tikoci/rosetta"],
    "enabled": true,
    "environment": {
      "PATH": "/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    }
  }
}
```

The explicit `PATH` matters: rosetta's bin shebang calls `bun`, which is not on the default OpenCode PATH. Replace `/root` with your own `$HOME` outside this machine. Refresh with `"$HOME/.bun/bin/bunx" @tikoci/rosetta@latest --refresh`; restart OpenCode after config changes.

## Memory model

- **Global** (`~/.config/opencode/memory/MEMORY.md`) — about the user, learned across projects. Preferences, style, decisions that hold everywhere.
- **Project** (`<project>/.pulse/memory/MEMORY.md`) — project-only: architecture, traps, current state. Local-only, gitignored.
- Project AGENTS.md stays the shared, committable source of truth. `.pulse/memory/` is private scratch — never duplicates it.
- Caps ~100 lines, stale entries pruned, duplicates merged. Never secrets.

## Context pruning

DCP plugin, config in `config/dcp.jsonc`: protects the last 4 turns and user messages; subagents may be pruned. Nudges are intentionally near-silent (`minContextLimit` 90%, `maxContextLimit` 100%) to avoid DCP issue #662 spam; use `/dcp-compress` or the model's `compress` tool proactively. Restart opencode after config changes.

## Updating

```sh
cd ~/pulse && git pull
```

Symlinked machines live immediately. Else re-copy `pulse.md`, `reviewer.md`, plugins, configs, and the bundled skill after pull. Skills installed via `npx skills ... -g` are copies, not symlinks — re-run the add commands (or `npx skills update -g` where supported) to refresh them.

## Verify

```sh
opencode plugin list                         # ponytail, casually, opencode-dcp
opencode mcp list                            # rosetta connected (chrome-devtools/firecrawl only if configured)
opencode api get /api/skill --param 'location[directory]=$PWD'
opencode api get /api/agent                  # should list pulse
git status --short                           # clean = committed state below
bash scripts/check.sh                        # package/README/pulse drift check
```

`/api/agent` should list `pulse`; `/api/skill` should list the repo's required skills. Restart opencode after `config/dcp.jsonc` changes; agent and memory edits watch/reload without one.

Context note: DCP + handoff + memory keep long sessions usable. No test suite exists in this repo — verify via the checks above.
