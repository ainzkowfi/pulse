---
name: routeros-network-ops
description: RouterOS and hotspot/ESP network-op changes for MikroTik RouterOS, ESP8266, and plain-JS portals. Use when editing firewall/NAT/DHCP/DNS, scripts, hotspot portals, firmware networking, or management access.
---

# RouterOS Network Ops

Leading rule: never strand management access.

## Before touching a live RouterOS device

- Inventory before design: model, RouterOS version, license level, installed packages, CPU/RAM/flash, port count/PoE budget, and wireless support. Read these from the device; don't assume a feature exists because another model has it. Design within those limits or say what won't fit. Persist the inventory facts to project memory so the next session skips re-reading unless the device changed.
- Record how you connect before the first change: one file per device at `.pulse/memory/devices/<name>.md` (gitignored with `.pulse/`). Store host/IP, transport (`ssh`/`scp`/`sftp`/`telnet`/REST/WinBox/serial), port, user, key path, and credential *reference* (env var name or secrets-file path, mode `0600`). Never write a raw password, token, or key into any memory file. Reuse the recorded method on every later session — don't guess. Missing fields → ask. Method changes → update the file and `verified:` date.
- Export and backup first (`/export file=...` for diffs/restore-by-readable-config, `/system backup save` for secret-bearing restore). Note interfaces in use and current default route/DNS.
- Confirm you have a second path back: another interface, serial/console, or a recorded backup you can restore.
- End every response that makes/applies a live RouterOS change with a paste-ready revert script: the exact commands (or the exact restore command for the recorded backup) to undo what the response just changed. If a change cannot be represented as a script, say why and give the safest equivalent (backup restore, reset, reflash). Never emit an apply-script without the revert block.
- Before any live change that can affect reachability (firewall/NAT/DHCP/DNS/routes/management), arm a one-shot 5-minute rollback scheduler on the device. It must run the same revert as the end-of-response block. Default timer is 5 minutes; longer only if the user asks.
- After applying, tell the user the rollback deadline. Leave the scheduler armed until the user explicitly confirms the new config is stable; a successful access check is not confirmation. Remove the scheduler and its script only then. If the timer fires, diagnose the revert before reapplying.
- Use safe mode where it fits your session.
- Change one variable at a time. Re-export after each accepted change.

## Firewall / NAT / management access

- Identify the input-chain path for your own management IP before editing rules. Keep an allow rule for that path until the new policy is proven.
- Never change the management interface address, VLAN, or input chain without a tested way back.
- For hotspot portals, check redirect rules (`dstnat`/`dst-port`/proxy), DNS, and Walled Garden together — portal breakage is usually one of DNS, NAT, or Walled Garden, not the page itself.
- Log hits temporarily for new drop/reject rules; remove noisy logs after verification.

## ESP8266 / hotspot firmware

- Keep pins, voltage, and brownout behavior in mind before changing Wi-Fi, watchdog, or reboot paths.
- Prefer static lease or reserved DHCP for infrastructure portals; document the reservation.
- Avoid OTA/flashing changes without a local serial fallback.

## Revert block shape

End with the smallest explicit block, e.g.:

```rsc
# revert for: <one-line description of the change>
# safest: restore the backup taken before the change
/system backup load file=pre-change-YYYYMMDD-HHMMSS.backup
# or, if exact commands are cleaner:
/ip firewall filter remove [find comment="pulse-change"]
/ip firewall nat remove [find comment="pulse-change"]
```

Use `comment="pulse-change"` (or the change-specific marker) on everything created so revert can target it without guessing by index.

## Rollback scheduler shape

Arm this before the change, not after. A non-zero interval with `start-time=startup` gives the first run 5 minutes after the entry is added (or 5 minutes after boot); the script removes its own timer before reverting so it cannot loop.

```rsc
# one-shot 5-minute rollback; replace id and revert commands
/system script add name="pulse-rollback-<id>" source={
  /system scheduler remove [find name="pulse-rollback-<id>"]
  :log warning "pulse-rollback-<id>: reverting"
  <exact revert commands from the response>
  /system script remove [find name="pulse-rollback-<id>"]
}
/system scheduler add name="pulse-rollback-<id>" start-time=startup interval=5m \
  on-event="pulse-rollback-<id>"
```

After the user explicitly confirms the config is stable:

```rsc
/system scheduler remove [find name="pulse-rollback-<id>"]
/system script remove [find name="pulse-rollback-<id>"]
```

## .rsc lint

Run the bundled linter before importing any `.rsc`: `python3 scripts/lint_rsc.py <file.rsc>` (exit 1 = fix and re-lint; `--strict` also fails on warnings). It checks idempotency guards, `:onerror`/`on-error=` wrappers, and unsafe patterns. Not a syntax proof — still dry-run import on the device (`import test.rsc verbose=yes dry-run`, RouterOS ≥ 7.16) before a real import.

## If the user asks to "just apply it"

Do the obvious read-only checks first (`/export compact`, current rules, current route/DNS). For irreversible changes, state the exact risk and the rollback you will use; if no rollback exists, stop and ask for console/serial access or a maintenance window.
