#!/usr/bin/env node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'pulse-plugins-'));

for (const [file, config] of [['casually.json', '{"enabled":true}']]) {
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

const casually = await setup('casually');
if (casually.commands.size !== 0) throw new Error('casually: unexpected mode commands');

const third = { sessionID: 's', system: [] };
await casually.hooks.context(third);
if (third.system.length !== 1 || !third.system[0].text.includes('ultra intensity')) {
  throw new Error('casually: always-on ultra instruction missing');
}

console.log('plugin checks ok');
