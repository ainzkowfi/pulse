---
name: routeros-network-ops
description: RouterOS and hotspot/ESP network-op changes for MikroTik RouterOS, ESP8266, and plain-JS portals. Use when editing firewall/NAT/DHCP/DNS, scripts, hotspot portals, firmware networking, or management access.
---

# RouterOS Network Ops

Leading rule: never strand management access.

## Before touching a live RouterOS device

- Export/backup first (`/export file=...` or the documented equivalent). Note versions, interfaces in use, and current default route/DNS.
- Confirm you have a second path back: another interface, serial/console, or a scheduled rollback window.
- Use safe mode or a rollback scheduler for firewall/NAT/management changes. Verify you can still reach the device before closing the session.
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

## If the user asks to "just apply it"

Do the obvious read-only checks first (`/export compact`, current rules, current route/DNS). For irreversible changes, state the exact risk and the rollback you will use; if no rollback exists, stop and ask for console/serial access or a maintenance window.
