// Blink the keyboard in Teams purple when the Teams Dock badge count rises. Run by launchd every 15 s.
// Reads only the Dock badge via lsappinfo (no permissions, no Teams data). `--dry-run` | `selftest`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { buildPackets, CLEAR, parseColor, parseKey, send } from './rgbkey.ts';

const STATE = `${homedir()}/Library/Caches/teams-rgb.state`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** lsappinfo output -> badge label, or null (no badge / Teams not running). */
export const parseBadge = (stdout: string): string | null => stdout.match(/"label"="([^"]*)"/)?.[1] ?? null;

export function shouldBlink(prev: string | null, cur: string | null): boolean {
  if (cur === null) return false;
  if (prev === null) return true;
  return /^\d+$/.test(prev) && /^\d+$/.test(cur) ? Number(cur) > Number(prev) : cur !== prev;
}

async function blink() {
  const on = buildPackets(parseKey('all').map((l) => [l, parseColor('5b5fc7')]));
  const off = buildPackets(parseKey('all').map((l) => [l, parseColor('off')]));
  for (let i = 0; i < 2; i++) {
    await send(on);
    await sleep(300);
    await send(off);
    await sleep(300);
  }
  await send([CLEAR]);
}

function selftest() {
  assert.equal(parseBadge('"StatusLabel"={ "label"=kCFNULL }'), null);
  assert.equal(parseBadge('"StatusLabel"={ "label"="3" }'), '3');
  assert.equal(parseBadge(''), null);
  assert.equal(parseBadge('"StatusLabel"={ "label"="•" }'), '•');
  const table: [string | null, string | null, boolean][] = [
    [null, null, false], ['2', null, false], [null, '3', true], ['2', '3', true], ['3', '3', false],
    ['3', '2', false], ['9', '10', true], ['•', '•', false], ['3', '•', true], ['•', '3', true],
  ];
  for (const [p, c, want] of table) assert.equal(shouldBlink(p, c), want, `${p} -> ${c}`);
  console.log('ok');
}

async function main() {
  if (process.argv[2] === 'selftest') return selftest();
  const dry = process.argv[2] === '--dry-run';
  const { stdout } = await promisify(execFile)('lsappinfo', ['info', '-only', 'StatusLabel', 'Microsoft Teams']);
  const cur = parseBadge(stdout);
  let prev: string | null = null;
  try { prev = readFileSync(STATE, 'utf8') || null; } catch {} // no state file yet = first run
  const go = shouldBlink(prev, cur);
  if (dry) return console.log(`badge=${cur} prev=${prev} blink=${go}`);
  if (go) {
    console.log(`blink: ${prev ?? 'none'} -> ${cur}`);
    await blink();
  }
  writeFileSync(STATE, cur ?? '');
}

main().catch((e: Error) => console.error(`${new Date().toISOString()} ${e.message}`));
