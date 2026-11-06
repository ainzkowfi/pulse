#!/usr/bin/env node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'pulse-plugins-'));

for (const [file, config] of [['caveman.json', '{"enabled":true,"defaultMode":"full"}'], ['ponytail.json', '{"enabled":true,"defaultMode":"full"}'], ['casually.json', '{"enabled":true,"defaultMode":"full"}']]) {
  writeFileSync(join(tmp, file), config);
}

async function loadPlugin(name) {
  return (await import(pathToFileURL(join(root, 'plugins', `${name}.ts`)).href)).default;
}

async function setup(name) {
  const hooks = {};
  const commands = new Map();
  const sent = [];
  const plugin = await loadPlugin(name);
  await plugin.setup({
    location: { directory: tmp },
    session: {
      hook: async (n, fn) => { hooks[n] = fn; },
      synthetic: async ({ text }) => { sent.push(text); },
      prompt: async () => {},
    },
    command: {
      transform: async (fn) => fn({ add: (cmd) => commands.set(cmd.name, cmd) }),
    },
  });
  return { hooks, commands, sent };
}

for (const name of ['caveman', 'ponytail', 'casually']) {
  const { hooks, commands, sent } = await setup(name);
  const first = { sessionID: 's', system: [] };
  await hooks.context(first);
  if (first.system.length !== 1) throw new Error(`${name}: default mode did not inject`);

  await commands.get(name).execute({ sessionID: 's', prompt: { text: 'off' }, delivery: 'test' });
  const second = { sessionID: 's', system: [] };
  await hooks.context(second);
  if (second.system.length !== 0) throw new Error(`${name}: explicit off fell back to default`);
}

console.log('plugin off-sticks ok');
