# pulse

Personal [opencode](https://opencode.ai) agent. Resolves material ambiguity before acting; low-risk work proceeds directly. Researches when unsure. Terse senior-dev output. Ponytail rules: YAGNI, shortest working diff, delete over add.

## What is Pulse?

Pulse is a personal, model-agnostic OpenCode agent for senior web development and network operations work — the kind where a wrong guess is expensive and a long vibe-coded answer is useless. It is terse by design, researches when it is unsure, and fills gaps only with evidence or explicit assumptions.

What it does:

- Reads the room first: repo `AGENTS.md`, project `.pulse/memory/MEMORY.md`, and your global memory before acting.
- Carries RouterOS/network-op safety defaults: export/backup before changes, rollback or safe mode, never strand management access.
- Resolves material ambiguity before acting; low-risk, obvious tasks proceed directly. Deep dives only when warranted.
- When it asks with options, each option says what it does/costs/changes; recommended option first.
- Researches niche or version-specific issues before answering — official docs over forums; cites its sources.
- Writes the minimum code that works: YAGNI, shortest working diff, deletion over addition, boring over clever.
- Loads skills on demand instead of stuffing every manual into context; `verification-loop` is the only always-loaded skill.
- Keeps durable state in two memory tiers: `.pulse/memory/` per project and `~/.config/opencode/memory/MEMORY.md` for cross-project preferences.
- Manages long sessions with DCP pruning and a context-budget rule; saves durable facts before quality drops.
- Pushes back with evidence when a request is wrong or harms the project; proceeds only if you insist.
- Stays model-agnostic: OpenCode selects the model (`/models`, `opencode run --model ...`, or config); Pulse carries no provider-specific prompt.

What it is not:

- Not an installer with hidden side effects — npm distribution ships files; wiring into OpenCode is explicit.
- Not a push bot — you push manually; the agent commits only when told.
- Not harness-agnostic — this is for OpenCode only.
- Not provider-locked — no model is baked into the agent prompt.
- Not a yes-man — if a request is wrong or harmful, it says so.

## Layout

```
agent/pulse.md                  the agent (V2 file agent)
agent/reviewer.md               hidden read-only reviewer subagent
skills/routeros-network-ops/    RouterOS/hotspot/ESP safety skill (bundled)
plugins/caveman.ts              caveman mode plugin (V2 port)
plugins/ponytail.ts             ponytail mode plugin (V2 port)
config/dcp.jsonc                dynamic context pruning (DCP plugin) config
config/caveman.json             caveman defaults (full)
config/ponytail.json            ponytail defaults (full)
memory/MEMORY.global.template.md   seed for global user memory
memory/MEMORY.project.template.md  seed for per-project memory
AGENTS.md                      repo traps; install stays in this README
package.json                   npm distribution (`pulse-opencode-agent`); no install scripts
```

## Install — paste this into opencode

On any machine, open a session and paste (replace `<repo-url>` with the git URL):

> Install the pulse opencode agent from `<repo-url>`:
> 1. Clone it into `~/pulse` (skip clone if it already exists).
> 2. `mkdir -p ~/.config/opencode/{agents,plugins,memory}`
> 3. Symlink `~/pulse/agent/pulse.md` → `~/.config/opencode/agents/pulse.md` and `~/pulse/agent/reviewer.md` → `~/.config/opencode/agents/reviewer.md` (if symlinks aren't supported, e.g. plain Windows, use `cp` instead and re-copy after every pull).
> 4. Install the bundled skill only if absent: `mkdir -p ~/.config/opencode/skills && ln -s ~/pulse/skills/routeros-network-ops ~/.config/opencode/skills/routeros-network-ops`.
> 5. Install required plugins only where missing; never overwrite an existing file:
>    - Symlink `~/pulse/plugins/caveman.ts` and `~/pulse/plugins/ponytail.ts` into `~/.config/opencode/plugins/`.
>    - Symlink `~/pulse/config/caveman.json`, `ponytail.json`, `dcp.jsonc` into `~/.config/opencode/` if absent.
>    - `opencode plugin add @tarquinen/opencode-dcp@latest` (skip if already in `opencode.json`)
> 6. Install required skills only if absent from both `~/.config/opencode/skills` and `~/.agents/skills`:
>    - `npx skills add vercel-labs/skills@find-skills -g -y`
>    - `npx skills add affaan-m/ecc@verification-loop -g -y`
>    - `npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y`
>    - `npx skills add pbakaus/impeccable@impeccable -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=diagnosing-bugs -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=writing-for-agents -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=retro -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=handoff -g -y`
>    - These four ship supporting files; install the full skill directories, not only `SKILL.md`.
> 7. Set `default_agent` to `"pulse"` in `~/.config/opencode/opencode.jsonc` (preserve all existing settings in the file).
> 8. If `~/.config/opencode/memory/MEMORY.md` does not exist, seed it from `~/pulse/memory/MEMORY.global.template.md`. Never overwrite an existing one.
> 9. Report what was done and what was skipped.

Per project, paste instead/also:

> Set up pulse project memory for this repo:
> 1. `mkdir -p .pulse/memory` and copy `~/pulse/memory/MEMORY.project.template.md` to `.pulse/memory/MEMORY.md` (skip copy if it already exists — never overwrite).
> 2. Ensure `.pulse/` is in `.gitignore` (append if missing).
> 3. Report.

No restart for agent/memory changes — opencode watches config files (`/reload` in the TUI forces it). Restart opencode after changing `dcp.jsonc`.

## Manual install (fallback)

```sh
git clone <repo-url> ~/pulse
mkdir -p ~/.config/opencode/{agents,plugins,memory,skills}
ln -s ~/pulse/agent/pulse.md ~/.config/opencode/agents/pulse.md
ln -s ~/pulse/agent/reviewer.md ~/.config/opencode/agents/reviewer.md
[ -e ~/.config/opencode/skills/routeros-network-ops ] || ln -s ~/pulse/skills/routeros-network-ops ~/.config/opencode/skills/routeros-network-ops
# plugins/configs: only if absent
[ -e ~/.config/opencode/plugins/caveman.ts ] || ln -s ~/pulse/plugins/caveman.ts ~/.config/opencode/plugins/caveman.ts
[ -e ~/.config/opencode/plugins/ponytail.ts ] || ln -s ~/pulse/plugins/ponytail.ts ~/.config/opencode/plugins/ponytail.ts
[ -e ~/.config/opencode/caveman.json ] || ln -s ~/pulse/config/caveman.json ~/.config/opencode/caveman.json
[ -e ~/.config/opencode/ponytail.json ] || ln -s ~/pulse/config/ponytail.json ~/.config/opencode/ponytail.json
[ -e ~/.config/opencode/dcp.jsonc ] || ln -s ~/pulse/config/dcp.jsonc ~/.config/opencode/dcp.jsonc
opencode plugin add @tarquinen/opencode-dcp@latest
# skills: only if absent
npx skills add vercel-labs/skills@find-skills -g -y
npx skills add affaan-m/ecc@verification-loop -g -y
npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y
npx skills add pbakaus/impeccable@impeccable -g -y
npx skills@latest add mattpocock/skills --skill=diagnosing-bugs -g -y
npx skills@latest add mattpocock/skills --skill=writing-for-agents -g -y
npx skills@latest add mattpocock/skills --skill=retro -g -y
npx skills@latest add mattpocock/skills --skill=handoff -g -y
# set "default_agent": "pulse" in ~/.config/opencode/opencode.jsonc (keep other settings)
cp ~/pulse/memory/MEMORY.global.template.md ~/.config/opencode/memory/MEMORY.md   # first machine only
```

Per project: `mkdir -p .pulse/memory && cp ~/pulse/memory/MEMORY.project.template.md .pulse/memory/MEMORY.md && echo '.pulse/' >> .gitignore`

## Install from npm

`pulse-opencode-agent` is a public npm snapshot of this repo for OpenCode only. It does **not** run an installer; after installing, wire the files into opencode the same way, using `$PULSE_ROOT` instead of `~/pulse`:

```sh
npm install -g pulse-opencode-agent
PULSE_ROOT="$(npm root -g)/pulse-opencode-agent"
mkdir -p ~/.config/opencode/{agents,plugins,memory,skills}
ln -s "$PULSE_ROOT/agent/pulse.md" ~/.config/opencode/agents/pulse.md
ln -s "$PULSE_ROOT/agent/reviewer.md" ~/.config/opencode/agents/reviewer.md
[ -e ~/.config/opencode/skills/routeros-network-ops ] || ln -s "$PULSE_ROOT/skills/routeros-network-ops" ~/.config/opencode/skills/routeros-network-ops
# plugins/configs: only if absent
[ -e ~/.config/opencode/plugins/caveman.ts ] || ln -s "$PULSE_ROOT/plugins/caveman.ts" ~/.config/opencode/plugins/caveman.ts
[ -e ~/.config/opencode/plugins/ponytail.ts ] || ln -s "$PULSE_ROOT/plugins/ponytail.ts" ~/.config/opencode/plugins/ponytail.ts
[ -e ~/.config/opencode/caveman.json ] || ln -s "$PULSE_ROOT/config/caveman.json" ~/.config/opencode/caveman.json
[ -e ~/.config/opencode/ponytail.json ] || ln -s "$PULSE_ROOT/config/ponytail.json" ~/.config/opencode/ponytail.json
[ -e ~/.config/opencode/dcp.jsonc ] || ln -s "$PULSE_ROOT/config/dcp.jsonc" ~/.config/opencode/dcp.jsonc
opencode plugin add @tarquinen/opencode-dcp@latest
# set "default_agent": "pulse" in ~/.config/opencode/opencode.jsonc (keep other settings)
cp "$PULSE_ROOT/memory/MEMORY.global.template.md" ~/.config/opencode/memory/MEMORY.md   # first machine only
```

Install the required skills from the Manual install section. Update later with `npm update -g pulse-opencode-agent`; existing symlinks keep resolving to the same paths. If you want `git pull` semantics instead, use the git install above.

## Memory model

- **Global** (`~/.config/opencode/memory/MEMORY.md`) — about the user, learned across projects. Preferences, style, decisions that hold everywhere.
- **Project** (`<project>/.pulse/memory/MEMORY.md`) — project-only: architecture, traps, current state. Local-only, gitignored.
- Project AGENTS.md stays the shared, committable source of truth. `.pulse/memory/` is private scratch — never duplicates it.
- Caps ~100 lines, stale entries pruned, duplicates merged. Never secrets.

## Context pruning

DCP plugin, config in `config/dcp.jsonc`: protects the last 4 turns and user messages; subagents may be pruned; compression thresholds 35%/70% of model window. This repo does not tune DCP dedupe/purge behavior. Restart opencode after config changes.

## Updating

```sh
cd ~/pulse && git pull          # git install
# or
npm update -g pulse-opencode-agent   # npm install
```

Symlinked machines live immediately. Else re-copy `pulse.md`, `reviewer.md`, plugins, configs, and the bundled skill after pull. Skills installed via `npx skills ... -g` are copies, not symlinks — re-run the add commands (or `npx skills update -g` where supported) to refresh them.

## Verify

```sh
opencode plugin list                         # caveman, ponytail, opencode-dcp
opencode api get /api/skill --param 'location[directory]=$PWD'
opencode api get /api/agent                  # should list pulse
git status --short                           # clean = committed state below
```

`/api/agent` should list `pulse`; `/api/skill` should list the repo's required skills. Restart opencode after `config/dcp.jsonc` changes; agent and memory edits watch/reload without one.

Context note: DCP + handoff + memory keep long sessions usable. No build/test suite exists in this repo — verify via the checks above, not `npm test`.
