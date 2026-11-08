#!/usr/bin/env python3
"""RouterOS .rsc heuristic linter.

Vendored from alexandre-machado/ai-stuffs@mikrotik-routeros-rsc (MIT).
Validates MikroTik RouterOS (.rsc) scripts for common safety, idempotency,
and security anti-patterns. Validated against the official RouterOS
Scripting manual:
    https://help.mikrotik.com/docs/spaces/ROS/pages/47579229/Scripting

This is a heuristic, line-oriented linter with lightweight scope tracking.
It understands:
  - Idempotent guard blocks ``:if ([:len [/... find where ...]] = 0) do={ add ... }``
  - Error handler wrappers ``:onerror v in={...} do={...}`` and
    ``:do {...} on-error={...}`` (import's 7.16.x parameter)
  - Loops ``:while`` / ``:for`` / ``:foreach`` for scoped ``:delay`` checks

Findings have three severities:
  error    — always bad; exit code 1
  warning  — should review; exit code 1 only with ``--strict``
  info     — nit; exit code always 0 for info alone

Exit codes:
  0  clean (or only info)
  1  errors found (or warnings in --strict)
  2  usage error / file not found
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Finding model
# ---------------------------------------------------------------------------

ERROR = "error"
WARNING = "warning"
INFO = "info"

_SEV_RANK = {ERROR: 3, WARNING: 2, INFO: 1}


@dataclass
class Finding:
    line: int
    severity: str
    rule: str
    message: str
    snippet: str

    def format_text(self) -> str:
        return (
            f"L{self.line} [{self.severity}] {self.rule}: {self.message}\n"
            f"    > {self.snippet}"
        )

    def to_dict(self) -> dict:
        return {
            "line": self.line,
            "severity": self.severity,
            "rule": self.rule,
            "message": self.message,
            "snippet": self.snippet,
        }


# ---------------------------------------------------------------------------
# Pattern library
# ---------------------------------------------------------------------------

# Destructive commands that should never appear in a script. These can never
# be suppressed by context.
DESTRUCTIVE_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    (
        "destructive/reset-configuration",
        re.compile(r"(?:^|/)system\s+reset-configuration\b", re.IGNORECASE),
        "`/system reset-configuration` wipes the device. Never embed this in a script.",
    ),
    (
        "destructive/routerboard-reset",
        re.compile(
            r"(?:^|/)system\s+routerboard\s+settings\s+reset-configuration\b",
            re.IGNORECASE,
        ),
        "`/system routerboard settings reset-configuration` wipes the device.",
    ),
    (
        "destructive/disk-format",
        re.compile(r"(?:^|/)disk\s+format-drive\b", re.IGNORECASE),
        "`/disk format-drive` erases storage. Not safe for unattended scripts.",
    ),
    (
        "destructive/package-downgrade",
        re.compile(r"(?:^|/)system\s+package\s+downgrade\b", re.IGNORECASE),
        "`/system package downgrade` forces a reboot and can brick unattended devices.",
    ),
    (
        "destructive/wireless-reset",
        re.compile(
            r"(?:^|/)interface\s+wireless\s+reset-configuration\b", re.IGNORECASE
        ),
        "`/interface wireless reset-configuration` wipes wireless config.",
    ),
]

# `remove [find]` without a `where` filter removes *every* entry in the menu.
BULK_REMOVE_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    (
        "dangerous/unconditional-firewall-remove",
        re.compile(
            r"(?:^|/)ip\s+firewall\s+(?:filter|nat|mangle|raw)\s+remove\s*\[\s*find\s*\]",
            re.IGNORECASE,
        ),
        "`remove [find]` with no `where` filter deletes every rule in the menu.",
    ),
    (
        "dangerous/unconditional-user-remove",
        re.compile(r"(?:^|/)user\s+remove\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/user remove [find]` with no filter deletes every user — including the admin account.",
    ),
    (
        "dangerous/unconditional-file-remove",
        re.compile(r"(?:^|/)file\s+remove\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/file remove [find]` with no filter deletes every file — including backups.",
    ),
    (
        "lockout/address-remove",
        re.compile(r"(?:^|/)ip\s+address\s+remove\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/ip address remove [find]` with no filter drops every address, including management.",
    ),
    (
        "lockout/route-remove",
        re.compile(r"(?:^|/)ip\s+route\s+remove\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/ip route remove [find]` with no filter drops every route, stranding management.",
    ),
    (
        "lockout/interface-disable",
        re.compile(r"(?:^|/)interface\s+disable\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/interface disable [find]` with no filter downs every interface.",
    ),
    (
        "lockout/service-disable",
        re.compile(r"(?:^|/)ip\s+service\s+disable\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/ip service disable [find]` with no filter kills management services (ssh/api/www).",
    ),
    (
        "lockout/bridge-port-remove",
        re.compile(r"(?:^|/)interface\s+bridge\s+port\s+remove\s*\[\s*find\s*\]", re.IGNORECASE),
        "`/interface bridge port remove [find]` with no filter detaches every bridge port.",
    ),
]

# Post-reboot / power-off commands worth a second look (warning, not error).
LOCKOUT_WARN_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    (
        "lockout/routerboard-upgrade",
        re.compile(r"(?:^|/)system\s+routerboard\s+upgrade\b", re.IGNORECASE),
        "`/system routerboard upgrade` reboots the device. Confirm management path survives it.",
    ),
    (
        "lockout/shutdown",
        re.compile(r"(?:^|/)system\s+shutdown\b", re.IGNORECASE),
        "`/system shutdown` powers the device off. Needs a wake plan.",
    ),
]

# Menus where `add` should be preceded by a `:if ([:len [... find where ...]] = 0)` guard.
IDEMPOTENT_MENUS: dict[str, re.Pattern[str]] = {
    "ip firewall filter": re.compile(
        r"(?:^|/)ip\s+firewall\s+filter\s+add\b", re.IGNORECASE
    ),
    "ip firewall nat": re.compile(
        r"(?:^|/)ip\s+firewall\s+nat\s+add\b", re.IGNORECASE
    ),
    "ip firewall mangle": re.compile(
        r"(?:^|/)ip\s+firewall\s+mangle\s+add\b", re.IGNORECASE
    ),
    "ip firewall raw": re.compile(
        r"(?:^|/)ip\s+firewall\s+raw\s+add\b", re.IGNORECASE
    ),
    "ip address": re.compile(r"(?:^|/)ip\s+address\s+add\b", re.IGNORECASE),
    "ip route": re.compile(r"(?:^|/)ip\s+route\s+add\b", re.IGNORECASE),
    "ip pool": re.compile(r"(?:^|/)ip\s+pool\s+add\b", re.IGNORECASE),
    "ip dhcp-server lease": re.compile(
        r"(?:^|/)ip\s+dhcp-server\s+lease\s+add\b", re.IGNORECASE
    ),
    "interface list member": re.compile(
        r"(?:^|/)interface\s+list\s+member\s+add\b", re.IGNORECASE
    ),
    "interface bridge port": re.compile(
        r"(?:^|/)interface\s+bridge\s+port\s+add\b", re.IGNORECASE
    ),
    "interface vlan": re.compile(r"(?:^|/)interface\s+vlan\s+add\b", re.IGNORECASE),
}

# Guard opener: `:if ([:len [/<menu> find where ...]] = 0) do={`.
GUARD_OPEN_RE = re.compile(
    r":if\s*\(\s*\[:len\s+\[\s*/?(?P<menu>[^\[]+?)\s*/?find\s+where\b"
    r"[^\]]*\]\s*\]\s*=\s*0\s*\)\s*do\s*=\s*\{",
    re.IGNORECASE,
)

# :onerror v in={...} do={...}
ONERROR_OPEN_RE = re.compile(r":onerror\b[^\n]*\bin\s*=\s*\{", re.IGNORECASE)

# Loop openers (note: bare `:do {` is NOT a loop — it becomes one only with `while=`).
LOOP_OPEN_RE = re.compile(r":(?:while|for|foreach)\b", re.IGNORECASE)

# `:do { ... } while=(...)` — a do-while loop.
DO_WHILE_RE = re.compile(r":do\s*\{", re.IGNORECASE)

# Any `import` usage (root or menu-qualified).
IMPORT_RE = re.compile(r"(?:^|[\s;/])import\b", re.IGNORECASE)

# `:log` interpolation of a secret-named variable (error).
LOG_SECRET_RE = re.compile(
    r":log\b.*\$[A-Za-z_]*\w*(?:password|secret|token|api[-_ ]?key)\b",
    re.IGNORECASE,
)
# `:log` concatenation of any variable (warning: value in log, not necessarily secret).
LOG_CONCAT_RE = re.compile(r":log\b.*\(\s*\"[^\"]*\"\s*\.\s*\$", re.IGNORECASE)

# Menu-only line: `/ip firewall filter` with the menu path alone, no command.
# Tokens include hyphens (`dhcp-server`); the last token must not be a verb.
MENU_ONLY_RE = re.compile(r"^/?(?:[A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)*)\s*$")
_MENU_VERBS = {"add", "set", "remove", "print", "get", "find", "export", "enable", "disable", "run", "reset", "reset-configuration"}

# `:foreach x in=[/<menu> find] do=` with no `where` and a `remove` on the line — iterates everything.
FOREACH_FIND_RE = re.compile(
    r":foreach\b[^\n]*\[\s*/?(?P<menu>[^\]]+?)\s*/?find\s*\]\s*do\s*=",
    re.IGNORECASE,
)


# `set 0 ...` or `remove 2` style fixed-id references.
FIXED_ID_RE = re.compile(r"(?:^|\s)(?:set|remove)\s+\d+\b")

# `:delay` usage.
DELAY_RE = re.compile(r":delay\b", re.IGNORECASE)

# `dont-require-permissions=yes` — documented security risk in Scripting Tips.
DONT_REQUIRE_PERMS_RE = re.compile(
    r"\bdont-require-permissions\s*=\s*yes\b", re.IGNORECASE
)

# Policies considered safe by default. Anything else triggers the excess check.
# `policy` (meta-policy) is intentionally excluded from the safe set — granting
# it lets a script modify other scripts.
MINIMAL_POLICIES = {"read", "write", "test"}

# `/system script add ... policy=a,b,c ...`
POLICY_ATTR_RE = re.compile(
    r"(?:^|/)system\s+script\s+add\b[^\n]*?\bpolicy\s*=\s*([A-Za-z,\-]+)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Scope tracking
# ---------------------------------------------------------------------------

@dataclass
class Scope:
    kind: str  # "root" | "guard" | "onerror" | "loop" | "plain"
    guard_menu: Optional[str] = None
    open_line: int = 0


def _normalize_menu(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.replace("/", " ").strip()).lstrip("/")


def _norm(stripped: str) -> str:
    """Slash-path form to space form so `/ip/firewall/nat add` matches `ip firewall nat add`."""
    return re.sub(r"\s+", " ", stripped.replace("/", " ")).strip()


def _strip_strings(code: str) -> str:
    """Remove "..." spans so brace counting is not fooled by braces in strings."""
    return re.sub(r'"(?:[^"\\]|\\.)*"', "", code)


def _find_do_onerror_lines(lines: list[str]) -> set[int]:
    """Return 1-based line numbers covered by `:do {...} on-error={...}` wrappers.

    Needed so a multi-line ``:do { ... import ... } on-error={ ... }`` block is
    recognised as an error handler even though the opening brace doesn't reveal
    its purpose until we see the matching close.

    Scans character-by-character so a line like ``} on-error={`` (which both
    closes the `:do` block and re-opens a new one) is handled correctly.
    """
    covered: set[int] = set()
    n = len(lines)
    # Build a stripped-copy of each line so we can walk characters and still
    # know the original line number for each position.
    stripped = [_strip_strings(l) for l in lines]

    i = 0  # 0-based line index we are currently *looking* at
    while i < n:
        match = DO_WHILE_RE.search(stripped[i])
        if not match:
            i += 1
            continue
        # Walk characters after the `:do {` until depth returns to 0.
        depth = 1
        line_idx = i
        col = match.end()
        close_line = -1
        close_col = -1
        while line_idx < n and depth > 0:
            row = stripped[line_idx]
            while col < len(row) and depth > 0:
                ch = row[col]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        close_line = line_idx
                        close_col = col
                        break
                col += 1
            if depth == 0:
                break
            line_idx += 1
            col = 0
        if close_line < 0:
            # Unbalanced — give up on this `:do` and continue scanning.
            i += 1
            continue
        # After the closing `}`, is the next non-space token `on-error=`?
        tail = stripped[close_line][close_col + 1 :]
        has_onerror_same_line = bool(re.match(r"\s*on-error\s*=", tail))
        has_onerror_next_line = False
        if not has_onerror_same_line and close_line + 1 < n:
            has_onerror_next_line = bool(
                re.match(r"\s*on-error\s*=", stripped[close_line + 1])
            )
        if has_onerror_same_line or has_onerror_next_line:
            # Cover every line from the `:do {` through the `on-error={...}`
            # block's own closing brace (everything between is the handler).
            # Conservatively cover from the line after `:do {` through the
            # closing `}` of the handler. First find the handler's close.
            handler_close = close_line
            # Find start of `on-error={` block.
            if has_onerror_same_line:
                onerror_line = close_line
                rest = stripped[close_line][close_col + 1 :]
                offset_in_rest = rest.find("{")
                onerror_col = close_col + 1 + offset_in_rest if offset_in_rest >= 0 else -1
            else:
                onerror_line = close_line + 1
                rest = stripped[onerror_line]
                offset_in_rest = rest.find("{")
                onerror_col = offset_in_rest
            if onerror_col >= 0:
                h_depth = 1
                h_line = onerror_line
                h_col = onerror_col + 1
                while h_line < n and h_depth > 0:
                    row = stripped[h_line]
                    while h_col < len(row) and h_depth > 0:
                        ch = row[h_col]
                        if ch == "{":
                            h_depth += 1
                        elif ch == "}":
                            h_depth -= 1
                            if h_depth == 0:
                                handler_close = h_line
                                break
                        h_col += 1
                    if h_depth == 0:
                        break
                    h_line += 1
                    h_col = 0
            # Mark 1-based line numbers from the `:do {` line through the
            # handler's closing brace. This guarantees any `import` inside
            # either block is recognised as error-handled.
            for k in range(i + 1, handler_close + 2):  # 1-based, inclusive
                covered.add(k)
            i = handler_close + 1
        else:
            i = close_line + 1
    return covered


def _logical_lines(lines: list[str]) -> list[tuple[int, str]]:
    r"""Join backslash continuations (RouterOS line continuation) into logical lines."""
    logical: list[tuple[int, str]] = []
    buf = ""
    start = 0
    for lineno, raw_line in enumerate(lines, start=1):
        if not buf:
            start = lineno
        line = raw_line.rstrip()
        if line.endswith("\\"):
            buf += line[:-1] + " "
            continue
        buf += line
        logical.append((start, buf))
        buf = ""
    if buf:
        logical.append((start, buf))
    return logical


def lint_text(text: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = text.splitlines()

    # Pre-pass: find line ranges that live inside a :do{} on-error={} wrapper.
    do_onerror_lines = _find_do_onerror_lines(lines)

    scopes: list[Scope] = [Scope(kind="root")]
    current_menu: Optional[str] = None

    for lineno, raw_line in _logical_lines(lines):
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # A menu-only line (`/ip firewall filter`) sets the current menu for
        # the commands that follow it (standard /export layout). Destructive
        # bare commands (`/system package downgrade`) match this shape too —
        # check them first, never swallow them silently.
        if MENU_ONLY_RE.match(stripped) and stripped.split()[-1].lower() not in _MENU_VERBS:
            for rule, rx, msg in DESTRUCTIVE_PATTERNS:
                if rx.search(_norm(stripped)):
                    findings.append(Finding(lineno, ERROR, rule, msg, stripped))
            for rule, rx, msg in LOCKOUT_WARN_PATTERNS:
                if rx.search(_norm(stripped)):
                    findings.append(Finding(lineno, WARNING, rule, msg, stripped))
            current_menu = _normalize_menu(stripped)
            continue
        # Patterns check the normalized form, so menu-relative commands
        # (`remove [find]` under `/ip firewall filter`) are tested too. Only
        # letter-led lines inherit the menu — `:foreach`/`}` lines don't.
        effective = _norm(f"/{current_menu} {stripped}" if current_menu and stripped[:1].isalpha() else stripped)

        # ---- Detect what this line opens (consumed when braces open) ----
        guard_menu = None
        gmatch = GUARD_OPEN_RE.search(stripped)
        if gmatch:
            guard_menu = _normalize_menu(gmatch.group("menu"))

        opens_onerror = bool(ONERROR_OPEN_RE.search(stripped))
        opens_loop = bool(LOOP_OPEN_RE.search(stripped))

        # ---- Compute context flags from the current scope stack ----
        inside_error_handler = (
            any(s.kind == "onerror" for s in scopes) or lineno in do_onerror_lines
        )
        inside_loop = any(s.kind == "loop" for s in scopes)
        enclosing_guard_menu: Optional[str] = None
        for s in reversed(scopes):
            if s.kind == "guard" and s.guard_menu:
                enclosing_guard_menu = s.guard_menu
                break

        # ---- Rule evaluation ----

        # Destructive commands — always error.
        for rule, rx, msg in DESTRUCTIVE_PATTERNS:
            if rx.search(effective):
                findings.append(Finding(lineno, ERROR, rule, msg, stripped))

        for rule, rx, msg in BULK_REMOVE_PATTERNS:
            if rx.search(effective):
                findings.append(Finding(lineno, ERROR, rule, msg, stripped))

        for rule, rx, msg in LOCKOUT_WARN_PATTERNS:
            if rx.search(effective):
                findings.append(Finding(lineno, WARNING, rule, msg, stripped))

        # `:foreach x in=[/<menu> find] do=` with no `where` and a `remove` in the
        # loop body (same line or a following line) removes every item. One-line
        # loops (balanced braces) never look ahead; multi-line loops track
        # brace depth so an inner `}` doesn't stop the scan early.
        fmatch = FOREACH_FIND_RE.search(stripped)
        start_code = _strip_strings(stripped)
        depth = start_code.count("{") - start_code.count("}")
        body_with_remove = bool(fmatch and re.search(r"\bremove\s", stripped, re.IGNORECASE))
        if fmatch and not body_with_remove and depth > 0:
            for ahead in lines[lineno : lineno + 10]:
                if re.search(r"\bremove\s", ahead.strip(), re.IGNORECASE):
                    body_with_remove = True
                    break
                ahead_code = _strip_strings(ahead)
                depth += ahead_code.count("{") - ahead_code.count("}")
                if depth <= 0:
                    break
        if fmatch and body_with_remove:
            findings.append(
                Finding(
                    lineno,
                    WARNING,
                    "dangerous/foreach-unconditional-remove",
                    f"`:foreach` over `[/{fmatch.group('menu').strip()} find]` with no `where` filter iterates every entry in the menu.",
                    stripped,
                )
            )

        # Idempotency: `add` in a sensitive menu must be inside a matching guard.
        for menu, rx in IDEMPOTENT_MENUS.items():
            if rx.search(effective):
                if enclosing_guard_menu and (
                    menu in enclosing_guard_menu or enclosing_guard_menu in menu
                ):
                    continue
                findings.append(
                    Finding(
                        lineno,
                        WARNING,
                        "idempotency/unguarded-add",
                        (
                            f"`{menu} add` is not wrapped in "
                            f"`:if ([:len [/{menu} find where ...]] = 0) do={{...}}`; "
                            "repeated runs will create duplicates."
                        ),
                        stripped,
                    )
                )

        # Fixed internal IDs (`set 0 ...`, `remove 2`).
        if FIXED_ID_RE.search(stripped):
            findings.append(
                Finding(
                    lineno,
                    WARNING,
                    "idempotency/fixed-id",
                    "Internal IDs renumber when items are added or removed. Use `[find where ...]` to select the target.",
                    stripped,
                )
            )

        # Excessive policies on /system script add.
        pmatch = POLICY_ATTR_RE.search(stripped)
        if pmatch:
            policies = {p.strip() for p in pmatch.group(1).split(",") if p.strip()}
            excess = policies - MINIMAL_POLICIES
            if excess:
                findings.append(
                    Finding(
                        lineno,
                        WARNING,
                        "security/excessive-policy",
                        f"Script grants elevated policies {sorted(excess)}. Grant only the minimum the script actually needs.",
                        stripped,
                    )
                )

        # dont-require-permissions=yes is called out as a risk in the official Tips & Tricks.
        if DONT_REQUIRE_PERMS_RE.search(stripped):
            findings.append(
                Finding(
                    lineno,
                    ERROR,
                    "security/dont-require-permissions",
                    "`dont-require-permissions=yes` lets the script bypass the caller's policy set. Documented as a security risk.",
                    stripped,
                )
            )

        # :delay inside a loop — risk of an unbounded spin loop.
        if DELAY_RE.search(stripped) and inside_loop:
            findings.append(
                Finding(
                    lineno,
                    WARNING,
                    "robustness/delay-in-loop",
                    "`:delay` inside a loop with no explicit bound can spin forever. Use `:retry max=... delay=...` or move periodic work to Scheduler.",
                    stripped,
                )
            )

        # `import` outside an error handler — a failure will abort the caller script silently.
        if IMPORT_RE.search(stripped) and not inside_error_handler and not opens_onerror:
            # Also accept if the same line is itself a `:do { import ... } on-error={...}` single-liner.
            same_line_do_onerror = bool(
                re.search(r":do\s*\{[^}]*\bimport\b[^}]*\}\s*on-error\s*=", stripped, re.IGNORECASE)
            )
            if not same_line_do_onerror:
                findings.append(
                    Finding(
                        lineno,
                        INFO,
                        "robustness/bare-import",
                        "`import` is not wrapped in `:onerror` or `:do {} on-error={}`. A failure will abort the caller without a chance to react.",
                        stripped,
                    )
                )

        # Credential exposure in :log.
        if LOG_SECRET_RE.search(stripped):
            findings.append(
                Finding(
                    lineno,
                    ERROR,
                    "security/log-secret",
                    "`:log` message references a secret-sounding variable. Never log passwords, tokens, or API keys.",
                    stripped,
                )
            )
        elif LOG_CONCAT_RE.search(stripped):
            findings.append(
                Finding(
                    lineno,
                    WARNING,
                    "security/log-concat",
                    "`:log` concatenates a variable into the message. Values land in logs; keep secrets out.",
                    stripped,
                )
            )

        # ---- Update scope stack based on brace delta on this line ----
        code = _strip_strings(stripped)
        opens = code.count("{")
        closes = code.count("}")

        for _ in range(opens):
            if guard_menu is not None:
                scopes.append(
                    Scope(kind="guard", guard_menu=guard_menu, open_line=lineno)
                )
                guard_menu = None
            elif opens_onerror:
                scopes.append(Scope(kind="onerror", open_line=lineno))
                opens_onerror = False
            elif opens_loop:
                scopes.append(Scope(kind="loop", open_line=lineno))
                opens_loop = False
            else:
                scopes.append(Scope(kind="plain", open_line=lineno))

        for _ in range(closes):
            if len(scopes) > 1:
                scopes.pop()

    return findings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="RouterOS .rsc heuristic linter.",
        epilog="Exit codes: 0=clean or info-only, 1=errors (or warnings with --strict), 2=usage error.",
    )
    p.add_argument("files", nargs="+", help="One or more .rsc files to lint.")
    p.add_argument("--json", action="store_true", help="Emit findings as JSON.")
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress info and warning messages; show only errors.",
    )
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if any warning is found (default: only errors cause non-zero exit).",
    )
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    results: list[tuple[Path, list[Finding]]] = []
    missing: list[Path] = []
    for f in args.files:
        path = Path(f)
        if not path.exists():
            missing.append(path)
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        results.append((path, lint_text(text)))

    if missing:
        for m in missing:
            print(f"File not found: {m}", file=sys.stderr)
        return 2

    if args.json:
        payload = [
            {"file": str(p), "findings": [f.to_dict() for f in fs]}
            for p, fs in results
        ]
        print(json.dumps(payload, indent=2))
    else:
        print("Lint .rsc — RouterOS heuristic check")
        for path, fs in results:
            print(f"\n== {path} ==")
            visible = [
                f for f in fs if not args.quiet or f.severity == ERROR
            ]
            if not visible:
                print("  (clean)")
                continue
            for f in visible:
                print(f"  {f.format_text()}")

    worst = 0
    for _, fs in results:
        for f in fs:
            worst = max(worst, _SEV_RANK.get(f.severity, 0))
    if worst >= _SEV_RANK[ERROR]:
        return 1
    if args.strict and worst >= _SEV_RANK[WARNING]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
