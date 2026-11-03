# pulse

Personal [opencode](https://opencode.ai) agent. Never assumes — asks first. Researches when unsure. Terse senior-dev output. Ponytail rules: YAGNI, shortest working diff, delete over add.

## Layout

```
agent/pulse.md                  the agent (V2 file agent)
memory/MEMORY.global.template.md   seed for global user memory
memory/MEMORY.project.template.md  seed for per-project memory
```

## Install (per machine)

```sh
git clone <this-repo-url> ~/pulse
mkdir -p ~/.config/opencode/agents ~/.config/opencode/memory
ln -s ~/pulse/agent/pulse.md ~/.config/opencode/agents/pulse.md
```

Windows without symlink developer mode: use `cp` instead of `ln -s` — but plain `cp` goes stale, so re-copy after every pull, or use developer mode and symlink.

Set `default_agent` in `~/.config/opencode/opencode.jsonc`:

```jsonc
{ "default_agent": "pulse" }
```

First machine only — seed the global memory:

```sh
cp memory/MEMORY.global.template.md ~/.config/opencode/memory/MEMORY.md
```

Per project:

```sh
cd <project>
mkdir -p .pulse/memory
cp ~/pulse/memory/MEMORY.project.template.md .pulse/memory/MEMORY.md
grep -qxF '.pulse/' .gitignore || echo '.pulse/' >> .gitignore
```

Opencode watches config files — no restart needed (or `/reload` in the TUI).

## Memory model

- **Global** (`~/.config/opencode/memory/MEMORY.md`) — about the user, learned across projects. Preferences, style, decisions that hold everywhere.
- **Project** (`<project>/.pulse/memory/MEMORY.md`) — project-only: architecture, traps, current state. Local-only, gitignored.
- Project AGENTS.md stays the shared, committable source of truth. `.pulse/memory/` is private scratch — never duplicates it.
- Caps ~100 lines, stale entries pruned, duplicates merged. Never secrets.

## Updating

```sh
cd ~/pulse && git pull
```

Symlinked machines are live immediately. Windows/`cp` machines must re-copy.
