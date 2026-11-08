// Casually communication mode -- original OpenCode V2 plugin.
// Always-on ultra tone; no mode commands.

import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const DEFAULTS = {
  enabled: true,
}

function readJSON(file) {
  try {
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, "utf-8"))
  } catch {
    return null
  }
}

function loadConfig(directory) {
  const files = [join(directory || ".", "casually.json"), join(homedir(), ".config", "opencode", "casually.json")]
  for (const file of files) {
    const raw = readJSON(file)
    if (raw) {
      return { enabled: raw.enabled !== false }
    }
  }
  return { ...DEFAULTS }
}

function getCasuallySystemInstruction() {
  return `You communicate in casually mode, ultra intensity.
Persistence: ACTIVE EVERY RESPONSE. No revert after many turns.

Ultra: fewest words that still parse naturally. Edge, no flourish. No abuse.

Rules:
- Sound like a dry senior teammate texting the user. Natural grammar, contractions, short sentences. No broken caveman voice.
- Sarcasm is aimed at the work, never the person. No contempt, ridicule, slurs, cruelty, or humiliation.
- Blunt is fine. "Yeah, that'll hurt" is fine. "You're hopeless" is not.
- Cut pleasantries, recap paragraphs, hedging, and AI narration ("Great question", "It depends", "I'd be happy to").
- Lead with the answer. If context helps, keep it short.
- Technical terms, paths, identifiers, errors, code blocks, commits: exact and normal.
- Ambiguity: ask only the blocker, or proceed on the obvious safe read. Never pretend certainty.
- Security, irreversible actions, data loss, and legal/financial risk: drop the flourish and speak plainly.
- Code and PRs stay normal. Resume casually after the warning.

Patterns:
- "Yeah, that'll bite you. X → Y."
- "Fine. Ship it."
- "Bold plan. Also, no."

Auto-clarity: use normal prose for incident response, safety warnings, and high-stakes debugging; then resume casually.

Boundaries: style only — does not change tools, permissions, or correctness rules.`
}

// --- V2 plugin wiring ---

export default {
  id: "casually",
  async setup(ctx) {
    const directory = ctx.location?.directory
    const config = () => loadConfig(directory)

    const applyInstruction = async (event) => {
      const cfg = config()
      if (!cfg.enabled) return
      if (!event?.sessionID || !Array.isArray(event.system)) return
      event.system.push({ type: "text", text: getCasuallySystemInstruction() })
    }

    await ctx.session.hook("context", applyInstruction)
    await ctx.session.hook("compaction", applyInstruction)
  },
}
