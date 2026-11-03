# pulse

Personal [opencode](https://opencode.ai) agent. Never assumes — asks first. Researches when unsure. Terse senior-dev output. Ponytail rules: YAGNI, shortest working diff, delete over add.

## Layout

```
agent/pulse.md                  the agent (V2 file agent)
memory/MEMORY.global.template.md   seed for global user memory
memory/MEMORY.project.template.md  seed for per-project memory
```

## Install — paste this into opencode

On any machine, open a session and paste (replace `<repo-url>` with the git URL):

> Install the pulse opencode agent from `<repo-url>`:
> 1. Clone it into `~/pulse` (skip clone if it already exists).
> 2. `mkdir -p ~/.config/opencode/agents ~/.config/opencode/memory`
> 3. Symlink `~/pulse/agent/pulse.md` → `~/.config/opencode/agents/pulse.md` (if symlinks aren't supported, e.g. plain Windows, use `cp` instead and re-copy after every pull).
> 4. Set `default_agent` to `"pulse"` in `~/.config/opencode/opencode.jsonc` (preserve all existing settings in the file).
> 5. If `~/.config/opencode/memory/MEMORY.md` does not exist, seed it from `~/pulse/memory/MEMORY.global.template.md`. Never overwrite an existing one.
> 6. Report what was done and what was skipped.

Per project, paste instead/also:

> Set up pulse project memory for this repo:
> 1. `mkdir -p .pulse/memory` and copy `~/pulse/memory/MEMORY.project.template.md` to `.pulse/memory/MEMORY.md` (skip copy if it already exists — never overwrite).
> 2. Ensure `.pulse/` is in `.gitignore` (append if missing).
> 3. Report.

No restart needed — opencode watches config files (`/reload` in the TUI forces it).

## Manual install (fallback)

```sh
git clone <repo-url> ~/pulse
mkdir -p ~/.config/opencode/agents ~/.config/opencode/memory
ln -s ~/pulse/agent/pulse.md ~/.config/opencode/agents/pulse.md
# set "default_agent": "pulse" in ~/.config/opencode/opencode.jsonc (keep other settings)
cp ~/pulse/memory/MEMORY.global.template.md ~/.config/opencode/memory/MEMORY.md   # first machine only
```

Per project: `mkdir -p .pulse/memory && cp ~/pulse/memory/MEMORY.project.template.md .pulse/memory/MEMORY.md && echo '.pulse/' >> .gitignore`

## Memory model

- **Global** (`~/.config/opencode/memory/MEMORY.md`) — about the user, learned across projects. Preferences, style, decisions that hold everywhere.
- **Project** (`<project>/.pulse/memory/MEMORY.md`) — project-only: architecture, traps, current state. Local-only, gitignored.
- Project AGENTS.md stays the shared, committable source of truth. `.pulse/memory/` is private scratch — never duplicates it.
- Caps ~100 lines, stale entries pruned, duplicates merged. Never secrets.

## Updating

```sh
cd ~/pulse && git pull
```

Symlinked machines live immediately. Else re-copy `pulse.md` after pull.
