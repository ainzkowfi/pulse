// Casually communication mode -- original OpenCode V2 plugin.
// Same wiring shape as the installed caveman V2 port, original instruction text.

import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const MODES = ["lite", "full", "ultra", "off"]

const DEFAULTS = {
  enabled: true,
  defaultMode: "full",
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
      return {
        enabled: raw.enabled !== false,
        defaultMode: raw.defaultMode ?? DEFAULTS.defaultMode,
      }
    }
  }
  return { ...DEFAULTS }
}

const stateMap = new Map()
const getMode = (sessionID) => stateMap.get(sessionID)
const setMode = (sessionID, mode) => {
  if (stateMap.size >= 200 && !stateMap.has(sessionID)) {
    const oldest = stateMap.keys().next().value
    if (oldest !== undefined) stateMap.delete(oldest)
  }
  stateMap.set(sessionID, mode)
}
const effectiveMode = (sessionID, cfg) => getMode(sessionID) ?? cfg.defaultMode

function getCasuallySystemInstruction(mode) {
  const base = `You communicate in casually mode.
Persistence: ACTIVE EVERY RESPONSE. No revert after many turns. Off only: "normal mode" or "/casually off".

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

Boundaries: style only — does not change tools, permissions, or correctness rules. Mode persists until changed or session end.`
  const examples = {
    lite: `Lite intensity: relaxed, natural, tight. Some dry wit allowed; still reads professional.
Example: "That re-render is from a fresh object prop. useMemo it."`,
    full: `Full intensity: default. Dry sarcasm, short, human, useful.
Example: "Yeah, that'll re-render on every keystroke. useMemo it."`,
    ultra: `Ultra intensity: fewest words that still parse naturally. Edge, no flourish. No abuse.
Example: "Fresh ref every render. useMemo."`,
  }
  return `${base}\n\n${examples[mode] || examples.full}`
}

// --- V2 plugin wiring ---

export default {
  id: "casually",
  async setup(ctx) {
    const directory = ctx.location?.directory
    const config = () => loadConfig(directory)

    const notify = async (sessionID, text) => {
      try {
        await ctx.session.synthetic({ sessionID, text, resume: false })
      } catch {
        console.warn(`[casually] ${text}`)
      }
    }

    const applyMode = async (event) => {
      const cfg = config()
      if (!cfg.enabled) return
      const sessionID = event?.sessionID
      if (!sessionID || !Array.isArray(event.system)) return
      let mode = getMode(sessionID)
      if (mode === undefined) {
        mode = cfg.defaultMode
        if (mode === "off") return
        setMode(sessionID, mode)
      }
      if (mode === "off") return
      event.system.push({ type: "text", text: getCasuallySystemInstruction(mode) })
    }

    await ctx.session.hook("context", applyMode)
    await ctx.session.hook("compaction", applyMode)
    await ctx.session.hook("title", applyMode)

    await ctx.command.transform((editor) => {
      const toggle = async (invocation) => {
        const cfg = config()
        const sessionID = invocation.sessionID
        const requested = (invocation.prompt?.text ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? ""
        if (!requested) {
          return notify(sessionID, `Mode: ${effectiveMode(sessionID, cfg)}. Use /casually ${MODES.join("|")}`)
        }
        if (!MODES.includes(requested)) {
          return notify(sessionID, `Bad mode. Valid: ${MODES.join(", ")}`)
        }
        setMode(sessionID, requested)
        return notify(sessionID, requested === "off" ? "Casually mode off." : `Casually mode ${requested}.`)
      }
      editor.add({ name: "casually", description: "Toggle casually communication mode", execute: toggle })
      editor.add({ name: "casually-mode", description: "Toggle casually communication mode", execute: toggle })
    })
  },
}
