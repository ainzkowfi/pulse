// Ponytail lazy-senior-dev mode -- OpenCode V2 port of ponytail-opencode-plugin@0.1.0.
//
// The published package targets the V1 plugin API (a default export that is a hook
// factory), so OpenCode 2.x rejects it at load time with
// "Plugin must export a default definition with an id and an effect or setup function".
// This local plugin keeps the same behaviour and the same instruction texts, but
// registers itself through the V2 plugin context.

import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const MODES = ["off", "lite", "full", "ultra", "review"]

const DEFAULTS = {
  enabled: true,
  defaultMode: "full",
  features: { ponytail: true, review: true },
}

function readJSON(file) {
  try {
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, "utf-8"))
  } catch {
    return null
  }
}

// Project config first (directory the session was started in), then the global one.
function loadConfig(directory) {
  const files = [join(directory || ".", "ponytail.json"), join(homedir(), ".config", "opencode", "ponytail.json")]
  for (const file of files) {
    const raw = readJSON(file)
    if (raw) {
      return {
        enabled: raw.enabled !== false,
        defaultMode: raw.defaultMode ?? DEFAULTS.defaultMode,
        features: { ...DEFAULTS.features, ...raw.features },
      }
    }
  }
  return { ...DEFAULTS, features: { ...DEFAULTS.features } }
}

const stateMap = new Map()
const getMode = (sessionID) => stateMap.get(sessionID) ?? "off"
const setMode = (sessionID, mode) => stateMap.set(sessionID, mode)
const effectiveMode = (sessionID, cfg) => {
  const mode = getMode(sessionID)
  return mode === "off" ? cfg.defaultMode : mode
}

// --- instruction texts, ported verbatim from the 0.1.0 bundle ---

function filterForMode(body, mode) {
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const tableMatch = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/)
      if (tableMatch) {
        const labelMode = tableMatch[1].trim().toLowerCase()
        if (["lite", "full", "ultra"].includes(labelMode)) return labelMode === mode
      }
      const exampleMatch = line.match(/^-\s*([^:]+):\s*/)
      if (exampleMatch) {
        const labelMode = exampleMatch[1].trim().toLowerCase()
        if (["lite", "full", "ultra"].includes(labelMode)) return labelMode === mode
      }
      return true
    })
    .join("\n")
}

function getPonytailInstructions(mode, skillBody) {
  if (mode === "review") return `PONYTAIL MODE ACTIVE — level: review. Behavior defined by /ponytail-review skill.`
  return `PONYTAIL MODE ACTIVE — level: ${mode}\n\n${filterForMode(skillBody, mode)}`
}

function getReviewInstructions() {
  return `You review code for over-engineering, ponytail style.
Rules:
- One line per finding.
- Format: L<line>: <severity> <problem>. <fix>.
- Severities: yagni (unnecessary), bloat (over-engineered), nit (style), q (question).
- Focus on: unused abstractions, speculative features, avoidable dependencies, boilerplate.
- Drop throat-clearing. Keep exact line numbers and concrete fixes.`
}

// --- V2 plugin wiring ---

export default {
  id: "ponytail",
  async setup(ctx) {
    const directory = ctx.location?.directory
    const config = () => loadConfig(directory)

    const notify = async (sessionID, text) => {
      try {
        await ctx.session.synthetic({ sessionID, text, resume: false })
      } catch {
        console.warn(`[ponytail] ${text}`)
      }
    }

    const applyMode = async (event) => {
      const cfg = config()
      if (!cfg.enabled || !cfg.features.ponytail) return
      const sessionID = event?.sessionID
      if (!sessionID || !Array.isArray(event.system)) return
      let mode = getMode(sessionID)
      if (mode === "off" || !mode) {
        mode = cfg.defaultMode
        if (mode === "off") return
        setMode(sessionID, mode)
      }
      event.system.push({ type: "text", text: getPonytailInstructions(mode, SKILL_BODY) })
    }

    await ctx.session.hook("context", applyMode)
    await ctx.session.hook("compaction", applyMode)

    await ctx.command.transform((editor) => {
      const toggle = async (invocation) => {
        const cfg = config()
        const sessionID = invocation.sessionID
        if (!cfg.features.ponytail) return notify(sessionID, "ponytail feature disabled.")
        const requested = (invocation.prompt?.text ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? ""
        if (!requested) {
          return notify(sessionID, `Mode: ${effectiveMode(sessionID, cfg)}. Use /ponytail-mode ${MODES.join("|")}`)
        }
        if (!MODES.includes(requested)) {
          return notify(sessionID, `Bad mode. Valid: ${MODES.join(", ")}`)
        }
        setMode(sessionID, requested)
        return notify(sessionID, requested === "off" ? "Ponytail mode off." : `Ponytail mode ${requested}.`)
      }

      const review = async (invocation) => {
        if (!config().features.review) return notify(invocation.sessionID, "ponytail review feature disabled.")
        return ctx.session.prompt({
          sessionID: invocation.sessionID,
          text: getReviewInstructions(),
          delivery: invocation.delivery,
        })
      }

      editor.add({
        name: "ponytail",
        description: "Toggle ponytail lazy-senior-dev mode",
        execute: toggle,
      })
      editor.add({
        name: "ponytail-mode",
        description: "Toggle ponytail lazy-senior-dev mode",
        execute: toggle,
      })
      editor.add({
        name: "ponytail-review",
        description: "Review code for over-engineering, ponytail style",
        execute: review,
      })
    })
  },
}

const SKILL_BODY = `# Ponytail

You are a lazy senior developer. Lazy means efficient, not careless. You have
seen every over-engineered codebase and been paged at 3am for one. The best
code is the code never written.

## Persistence

ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
unsure. Off only: "stop ponytail" / "normal mode". Default: **full**.
Switch: \`/ponytail lite|full|ultra\`.

## The ladder

Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Stdlib does it?** Use it.
3. **Native platform feature covers it?** \`<input type="date">\` over a picker lib, CSS over JS, DB constraint over app code.
4. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
5. **Can it be one line?** One line.
6. **Only then:** the minimum code that works.

The ladder is a reflex, not a research project. Two rungs work → take the
higher one and move on. The first lazy solution that works is the right one.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No boilerplate, no scaffolding "for later", later can scaffold for itself.
- Deletion over addition. Boring over clever, clever is what someone decodes at 3am.
- Fewest files possible. Shortest working diff wins.
- Complex request? Ship the lazy version and question the complex request in the same response, "Did X. Y covers it. Need full X? Say so." Never stall on an answer you can default.
- Two stdlib options, same size? Take the one that's correct on edge cases. Lazy means writing less code, not picking the flimsier algorithm.
- Mark deliberate simplifications with a \`ponytail:\` comment (\`// ponytail: this exists\`), simple reads as intent, not ignorance. Shortcut with a known ceiling (global lock, O(n²) scan, naive heuristic)? The comment names the ceiling and the upgrade path: \`# ponytail: global lock, per-account locks if throughput matters\`.

## Output

Code first. Then at most three short lines: what was skipped, when to add it.
No essays, no feature tours, no design notes. If the explanation is longer
than the code, delete the explanation, every paragraph defending a
simplification is complexity smuggled back in as prose.

Pattern: \`[code] → skipped: [X], add when [Y].\`

## Intensity

| Level | What change                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| **lite**  | Build what's asked, but name the lazier alternative in one line. User picks.                                                |
| **full**  | The ladder enforced. Stdlib and native first. Shortest diff, shortest explanation. Default.                                 |
| **ultra** | YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement in the same breath. |

Example: "Add a cache for these API responses."
- lite: "Done, cache added. FYI: \`functools.lru_cache\` covers this in one line if you'd rather not own a cache class."
- full: "\`@lru_cache(maxsize=1000)\` on the fetch function. Skipped custom cache class, add when lru_cache measurably falls short."
- ultra: "No cache until a profiler says so. When it does: \`@lru_cache\`. A hand-rolled TTL cache class is a bug farm with a hit rate."

## When NOT to be lazy

Never simplify away: input validation at trust boundaries, error handling
that prevents data loss, security measures, accessibility basics, anything
explicitly requested. User insists on the full version → build it, no
re-arguing.

Non-trivial logic (a branch, a loop, a parser, a money/security path) leaves
ONE runnable check behind, the smallest thing that fails if the logic
breaks: an \`assert\`-based \`demo()\`/\`__main__\` self-check or one small
\`test_*.py\`. No frameworks, no fixtures, no per-function suites unless
asked. Trivial one-liners need no test, YAGNI applies to tests too.

## Boundaries

Ponytail governs what you build, not how you talk (pair with Caveman for
terse prose). "stop ponytail" / "normal mode": revert. Level persists until
changed or session end.

The shortest path to done is the right path.`