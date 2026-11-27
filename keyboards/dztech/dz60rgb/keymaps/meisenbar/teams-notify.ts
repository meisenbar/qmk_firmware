// Blink the keyboard in Teams purple when the Teams Dock badge count rises. Long-running (launchd KeepAlive), polls every 2 s.
// Reads only the Dock badge via lsappinfo (no permissions, no Teams data). `--dry-run` | `selftest`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { buildPackets, CLEAR, parseColor, parseKey, send } from './rgbkey.ts';

// Tuned for the LEDs (5b5fc7, the brand colour, renders almost white), not the exact Teams purple.
const TEAMS_PURPLE = '5d30e3';
const POLL_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** lsappinfo output -> badge label, or null (no badge / Teams not running). */
export const parseBadge = (stdout: string): string | null => stdout.match(/"label"="([^"]*)"/)?.[1] ?? null;

export function shouldBlink(prev: string | null, cur: string | null): boolean {
  if (cur === null) return false;
  if (prev === null) return true;
  return /^\d+$/.test(prev) && /^\d+$/.test(cur) ? Number(cur) > Number(prev) : cur !== prev;
}

export async function blink() {
  const on = buildPackets(parseKey('all').map((l) => [l, parseColor(TEAMS_PURPLE)]));
  const off = buildPackets(parseKey('all').map((l) => [l, parseColor('off')]));
  for (let i = 0; i < 2; i++) {
    await send(on);
    await sleep(300);
    await send(off);
    await sleep(300);
  }
  await send([CLEAR]);
}

async function readBadge(): Promise<string | null> {
  const { stdout } = await promisify(execFile)('lsappinfo', ['info', '-only', 'StatusLabel', 'Microsoft Teams']);
  return parseBadge(stdout);
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
  if (process.argv[2] === '--dry-run') return console.log(`badge=${await readBadge()}`);
  rmSync(`${homedir()}/Library/Caches/teams-rgb.state`, { force: true }); // legacy state file
  let prev: string | null | undefined; // undefined until the first read, so a (re)start never blinks
  let lastErr = '';
  for (;;) {
    try {
      const cur = await readBadge();
      if (prev !== undefined && shouldBlink(prev, cur)) {
        console.log(`blink: ${prev ?? 'none'} -> ${cur}`);
        await blink();
      }
      prev = cur;
      lastErr = '';
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== lastErr) console.error(`${new Date().toISOString()} ${msg}`);
      lastErr = msg;
    }
    await sleep(POLL_MS);
  }
}

if (import.meta.main) main().catch((e: Error) => console.error(`${new Date().toISOString()} ${e.message}`));
