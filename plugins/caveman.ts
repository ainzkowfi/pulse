// Caveman communication mode -- OpenCode V2 port of caveman-opencode-plugin@0.1.5.
//
// The published package still targets the V1 plugin API (a default export that is
// a hook factory), so OpenCode 2.x rejects it at load time with
// "Plugin must export a default definition with an id and an effect or setup function".
// This local plugin keeps the same behaviour and the same instruction texts, but
// registers itself through the V2 plugin context.

import { appendFileSync, existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const MODES = ["lite", "full", "ultra", "wenyan-lite", "wenyan-full", "wenyan-ultra", "off"]

const DEFAULTS = {
  enabled: true,
  defaultMode: "off",
  features: { caveman: true, commit: true, review: true },
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
  const files = [join(directory || ".", "caveman.json"), join(homedir(), ".config", "opencode", "caveman.json")]
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

// --- instruction texts, ported verbatim from the 0.1.5 bundle ---

// src/skills/caveman.ts
function getCavemanSystemInstruction(mode) {
  const base = `You communicate in caveman mode.
Persistence: ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift. Still active if unsure. Off only: "stop caveman" / "normal mode".

Rules:
- Drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging.
- Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for").
- Technical terms exact. Code blocks unchanged. Errors quoted exact.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
- Yes: "Bug in auth middleware. Token expiry check use < not <=. Fix:"

Auto-clarity (drop caveman when):
- Security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, compression creates technical ambiguity.
- Write normal paragraph, then resume caveman.

Boundaries: Code/commits/PRs write normal. "stop caveman" or "normal mode" -> revert. Mode persists until changed or session end.`;
  const examples = {
    lite: `Lite intensity: no filler/hedging. Keep articles + full sentences. Professional but tight.
Example: "Your component re-renders because you create a new object reference each render. Wrap it in useMemo."`,
    full: `Full intensity: drop articles, fragments OK, short synonyms. Classic caveman.
Example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo."`,
    ultra: `Ultra intensity: abbreviate prose words (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough. Code symbols, function names, API names, error strings: never abbreviate.
Example: "Inline obj prop → new ref → re-render. useMemo."`,
    "wenyan-lite": `Wenyan lite: semi-classical. Drop filler/hedging but keep grammar structure, classical register.
Example: "組件頻重繪，以每繪新生對象參照故。以 useMemo 包之。"`,
    "wenyan-full": `Wenyan full: classical Chinese terseness. 文言文. 80-90% character reduction. Classical sentence patterns, verbs precede objects, subjects often omitted, classical particles (之/乃/為/其).
Example: "物出新參照，致重繪。useMemo Wrap之。"`,
    "wenyan-ultra": `Wenyan ultra: extreme abbreviation while keeping classical Chinese feel.
Example: "新參照→重繪。useMemo Wrap。"`
  };
  const example = examples[mode] || examples.full;
  return `${base}

${example}`;
}
// src/skills/commit.ts
function getCommitSystemInstruction() {
  return `You generate conventional commit messages caveman style. No fluff. Why over what.

Subject line:
- <type>(<scope>): <imperative summary> — <scope> optional
- Types: feat, fix, refactor, perf, docs, test, chore, build, ci, style, revert
- Imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- ≤50 chars when possible, hard cap 72
- No trailing period

Body (only if needed):
- Skip entirely when subject is self-explanatory
- Add body only for: non-obvious why, breaking changes, migration notes, linked issues
- Wrap at 72 chars
- Bullets with - not *
- Reference issues/PRs at end: Closes #42, Refs #17

Never include:
- "This commit does X", "I", "we", "now", "currently" — diff says what
- "As requested by..." — use Co-authored-by trailer
- AI attribution or emoji (unless project convention requires)
- Restating file name when scope already says it

Examples:
Diff: new profile endpoint with body explaining why
Correct: "feat(api): add GET /users/:id/profile

Mobile client needs profile data without full user payload
to reduce LTE bandwidth on cold-launch screens.

Closes #128"
Wrong: "feat: add a new endpoint to get user profile information from the database"

Diff: breaking API change
Correct: "feat(api)!: rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
before 2026-06-01. Old route returns 410 after that date."

Auto-clarity: always include body for breaking changes, security fixes, data migrations, reverts. Never compress these into subject-only.

Boundaries: only generates commit message. Does not run git commit, does not stage files. Output as code block ready to paste. "stop caveman-commit" or "normal mode": revert to verbose style.`;
}
// src/skills/review.ts
function getReviewSystemInstruction() {
  return `You review code caveman style. One line per finding. Location, problem, fix. No throat-clearing.

Format: L<line>: <problem>. <fix>. — or <file>:L<line>: ... when reviewing multi-file diffs.

Severity prefixes (use when severity varies across comments):
\uD83D\uDD34 bug: — broken behavior, will cause incident
\uD83D\uDFE1 risk: — works but fragile (race, missing null check, swallowed error)
\uD83D\uDD35 nit: — style, naming, micro-optim. Author can ignore
❓ q: — genuine question, not a suggestion

Drop:
- "I noticed that...", "It seems like...", "You might want to consider..."
- "This is just a suggestion but..." — use nit: instead
- "Great work!", "Looks good overall but..." — say once at top, not per comment
- Restating what the line does — reviewer can read the diff
- Hedging ("perhaps", "maybe", "I think") — if unsure use q:

Keep:
- Exact line numbers
- Exact symbol/function/variable names in backticks
- Concrete fix, not "consider refactoring this"
- The why if the fix isn't obvious from problem statement

Examples:
Wrong: "I noticed that on line 42 you're not checking if the user object is null before accessing the email property. This could potentially cause a crash if the user is not found in the database. You might want to add a null check here."
Correct: "L42: \uD83D\uDD34 bug: user can be null after .find(). Add guard before .email."

Wrong: "It looks like this function is doing a lot of things and might benefit from being broken up into smaller functions for readability."
Correct: "L88-140: \uD83D\uDD35 nit: 50-line fn does 4 things. Extract validate/normalize/persist."

Wrong: "Have you considered what happens if the API returns a 429? I think we should probably handle that case."
Correct: "L23: \uD83D\uDFE1 risk: no retry on 429. Wrap in withBackoff(3)."

Auto-clarity: drop terse mode for security findings (CVE-class bugs need full explanation + reference), architectural disagreements (need rationale), onboarding contexts where author needs the why. Write normal paragraph, then resume terse.

Boundaries: reviews only — does not write code fix, does not approve/request-changes, does not run linters. Output comments ready to paste into PR. "stop caveman-review" or "normal mode": revert to verbose style.`;
}

// --- V2 plugin wiring ---

export default {
  id: "caveman",
  async setup(ctx) {
    const directory = ctx.location?.directory
    const config = () => loadConfig(directory)

    // Feedback channel that does not burn a model call.
    const notify = async (sessionID, text) => {
      try {
        await ctx.session.synthetic({ sessionID, text, resume: false })
      } catch {
        console.warn(`[caveman] ${text}`)
      }
    }

    const applyMode = async (event) => {
      const cfg = config()
      if (!cfg.enabled || !cfg.features.caveman) return
      const sessionID = event?.sessionID
      if (!sessionID || !Array.isArray(event.system)) return
      let mode = getMode(sessionID)
      if (mode === "off" || !mode) {
        mode = cfg.defaultMode
        if (mode === "off") return
        setMode(sessionID, mode)
      }
      event.system.push({ type: "text", text: getCavemanSystemInstruction(mode) })
    }

    await ctx.session.hook("context", applyMode)
    await ctx.session.hook("compaction", applyMode)
    await ctx.session.hook("title", applyMode)

    await ctx.command.transform((editor) => {
      const toggle = async (invocation) => {
        const cfg = config()
        const sessionID = invocation.sessionID
        if (!cfg.features.caveman) return notify(sessionID, "caveman feature disabled.")
        const requested = (invocation.prompt?.text ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? ""
        if (!requested) {
          return notify(sessionID, `Mode: ${effectiveMode(sessionID, cfg)}. Use /caveman-mode ${MODES.join("|")}`)
        }
        if (!MODES.includes(requested)) {
          return notify(sessionID, `Bad mode. Valid: ${MODES.join(", ")}`)
        }
        setMode(sessionID, requested)
        return notify(sessionID, requested === "off" ? "Caveman mode off." : `Caveman mode ${requested}.`)
      }

      const instruct = (feature, text) => async (invocation) => {
        if (!config().features[feature]) {
          return notify(invocation.sessionID, `${feature} feature disabled.`)
        }
        await ctx.session.prompt({
          sessionID: invocation.sessionID,
          text,
          delivery: invocation.delivery,
        })
      }

      editor.add({
        name: "caveman",
        description: "Toggle caveman communication mode",
        execute: toggle,
      })
      editor.add({
        name: "caveman-mode",
        description: "Toggle caveman communication mode",
        execute: toggle,
      })
      editor.add({
        name: "caveman-commit",
        description: "Generate commit messages in caveman style",
        execute: instruct("commit", getCommitSystemInstruction()),
      })
      editor.add({
        name: "caveman-review",
        description: "Review code in caveman style",
        execute: instruct("review", getReviewSystemInstruction()),
      })
    })
  },
}
