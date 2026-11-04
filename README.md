# pulse

Personal [opencode](https://opencode.ai) agent. Never assumes — asks first. Researches when unsure. Terse senior-dev output. Ponytail rules: YAGNI, shortest working diff, delete over add.

## Layout

```
agent/pulse.md                  the agent (V2 file agent)
plugins/caveman.ts              caveman mode plugin (V2 port)
plugins/ponytail.ts             ponytail mode plugin (V2 port)
config/dcp.jsonc                dynamic context pruning (DCP plugin) config
config/caveman.json             caveman defaults (full)
config/ponytail.json            ponytail defaults (full)
memory/MEMORY.global.template.md   seed for global user memory
memory/MEMORY.project.template.md  seed for per-project memory
AGENTS.md                      repo traps; install stays in this README
```

## Install — paste this into opencode

On any machine, open a session and paste (replace `<repo-url>` with the git URL):

> Install the pulse opencode agent from `<repo-url>`:
> 1. Clone it into `~/pulse` (skip clone if it already exists).
> 2. `mkdir -p ~/.config/opencode/{agents,plugins,memory}`
> 3. Symlink `~/pulse/agent/pulse.md` → `~/.config/opencode/agents/pulse.md` (if symlinks aren't supported, e.g. plain Windows, use `cp` instead and re-copy after every pull).
> 4. Install required plugins only where missing; never overwrite an existing file:
>    - Symlink `~/pulse/plugins/caveman.ts` and `~/pulse/plugins/ponytail.ts` into `~/.config/opencode/plugins/`.
>    - Symlink `~/pulse/config/caveman.json`, `ponytail.json`, `dcp.jsonc` into `~/.config/opencode/` if absent.
>    - `opencode plugin add @tarquinen/opencode-dcp@latest` (skip if already in `opencode.json`)
> 5. Install required skills only if absent from both `~/.config/opencode/skills` and `~/.agents/skills`:
>    - `npx skills add vercel-labs/skills@find-skills -g -y`
>    - `npx skills add affaan-m/ecc@verification-loop -g -y`
>    - `npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y`
>    - `npx skills add pbakaus/impeccable@impeccable -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=diagnosing-bugs -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=writing-for-agents -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=retro -g -y`
>    - `npx skills@latest add mattpocock/skills --skill=handoff -g -y`
>    - These four ship supporting files; install the full skill directories, not only `SKILL.md`.
> 6. Set `default_agent` to `"pulse"` in `~/.config/opencode/opencode.jsonc` (preserve all existing settings in the file).
> 7. If `~/.config/opencode/memory/MEMORY.md` does not exist, seed it from `~/pulse/memory/MEMORY.global.template.md`. Never overwrite an existing one.
> 8. Report what was done and what was skipped.

Per project, paste instead/also:

> Set up pulse project memory for this repo:
> 1. `mkdir -p .pulse/memory` and copy `~/pulse/memory/MEMORY.project.template.md` to `.pulse/memory/MEMORY.md` (skip copy if it already exists — never overwrite).
> 2. Ensure `.pulse/` is in `.gitignore` (append if missing).
> 3. Report.

No restart for agent/memory changes — opencode watches config files (`/reload` in the TUI forces it). Restart opencode after changing `dcp.jsonc`.

## Manual install (fallback)

```sh
git clone <repo-url> ~/pulse
mkdir -p ~/.config/opencode/{agents,plugins,memory}
ln -s ~/pulse/agent/pulse.md ~/.config/opencode/agents/pulse.md
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

## Memory model

- **Global** (`~/.config/opencode/memory/MEMORY.md`) — about the user, learned across projects. Preferences, style, decisions that hold everywhere.
- **Project** (`<project>/.pulse/memory/MEMORY.md`) — project-only: architecture, traps, current state. Local-only, gitignored.
- Project AGENTS.md stays the shared, committable source of truth. `.pulse/memory/` is private scratch — never duplicates it.
- Caps ~100 lines, stale entries pruned, duplicates merged. Never secrets.

## Context pruning

DCP plugin, config in `config/dcp.jsonc`: compress closed chapters, dedupe repeated tool output, purge errored tool inputs after 4 turns. Last 4 turns and user messages protected; thresholds 35%/70% of model window; subagents pruned too. Restart opencode after config changes.

## Updating

```sh
cd ~/pulse && git pull
```

Symlinked machines live immediately. Else re-copy `pulse.md`, plugins, and configs after pull. Skills installed via `npx skills ... -g` are copies, not symlinks — re-run the add commands (or `npx skills update -g` where supported) to refresh them.

## Verify

```sh
opencode plugin list                         # caveman, ponytail, opencode-dcp
opencode api get /api/skill --param 'location[directory]=$PWD'
```

`/api/agent` should list `pulse`; `/api/skill` should list the repo's required skills. Restart opencode after `config/dcp.jsonc` changes; agent and memory edits watch/reload without one.
