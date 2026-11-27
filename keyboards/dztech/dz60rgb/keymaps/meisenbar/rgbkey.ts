// Per-key RGB overrides for the DZ60RGB v2 over raw HID. Needs Node 24+ and `npm install` (node-hid).
//   node rgbkey.ts set KEY COLOR [KEY COLOR ...]   KEY: name (esc, space, /...), a,b,c list, all, or LED index 0..62
//   node rgbkey.ts clear                           COLOR: RRGGBB, #RRGGBB, or red green blue white yellow cyan magenta orange purple off
//   node rgbkey.ts keys                            print the key table
//   node rgbkey.ts selftest                        no device needed
import assert from 'node:assert/strict';

const VID = 0x445a, PID = 0x1121; // info.json usb.vid, v2/keyboard.json usb.pid
const ROWS = [
  'esc:13 1:12 2:11 3:10 4:9 5:8 6:7 7:6 8:5 9:4 0:3 minus:2 equal:1 backspace:0',
  'tab:27 q:26 w:25 e:24 r:23 t:22 y:21 u:20 i:19 o:18 p:17 lbracket:16 rbracket:15 backslash:14',
  'caps:40 a:39 s:38 d:37 f:36 g:35 h:34 j:33 k:32 l:31 semicolon:30 quote:29 enter:28',
  'lshift:53 z:52 x:51 c:50 v:49 b:48 n:47 m:46 comma:45 dot:44 slash:43 up:42 del:41',
  'lctrl:62 lalt:61 lgui:60 space:59 ralt:58 fn:57 left:56 down:55 right:54',
];
const LEDS = new Map(ROWS.flatMap((r) => r.split(' ').map((p) => p.split(':') as [string, string])).map(([k, i]) => [k, Number(i)]));
const ALIAS: Record<string, string> = {
  spc: 'space', bspc: 'backspace', ctrl: 'lctrl', alt: 'lalt', cmd: 'lgui', shift: 'lshift', rshift: 'slash',
  '/': 'slash', ',': 'comma', '.': 'dot', ';': 'semicolon', "'": 'quote', '-': 'minus', '=': 'equal',
  '[': 'lbracket', ']': 'rbracket', '\\': 'backslash',
};
const COLORS: Record<string, string> = {
  red: 'ff0000', green: '00ff00', blue: '0000ff', white: 'ffffff', yellow: 'ffff00',
  cyan: '00ffff', magenta: 'ff00ff', orange: 'ff8000', purple: '8000ff', off: '000000',
};
type Rgb = [number, number, number];

/** One key token -> LED indices ('all' gives every LED). */
export function parseKey(token: string): number[] {
  const t = token.toLowerCase();
  if (t === 'all') return [...LEDS.values()].sort((a, b) => a - b);
  const led = LEDS.get(ALIAS[t] ?? t) ?? (/^\d+$/.test(t) && Number(t) < LEDS.size ? Number(t) : undefined);
  if (led === undefined) throw new Error(`unknown key: ${token}`);
  return [led];
}

export function parseColor(token: string): Rgb {
  const hex = COLORS[token.toLowerCase()] ?? token.replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`unknown colour: ${token}`);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

/** [led, rgb] pairs -> 33-byte HID reports (report id 0 + 32 data bytes), max 7 LEDs each. */
export function buildPackets(pairs: [number, Rgb][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < pairs.length; i += 7) {
    const chunk = pairs.slice(i, i + 7);
    out.push(pad([0x07, 0x00, 0x01, chunk.length, ...chunk.flatMap(([led, rgb]) => [led, ...rgb])]));
  }
  return out;
}

const pad = (data: number[]) => [0, ...data, ...new Array(32 - data.length).fill(0)];
export const CLEAR = pad([0x07, 0x00, 0x02]);

/** Write HID reports to the keyboard; throws if it is not found. */
export async function send(packets: number[][]) {
  const { default: HID } = await import('node-hid');
  const info = HID.devices(VID, PID).find((d) => d.usagePage === 0xff60 && d.usage === 0x61);
  if (!info?.path) throw new Error('keyboard not found — is it plugged in and running the VIA firmware?');
  const dev = new HID.HID(info.path);
  try {
    for (const p of packets) dev.write(p);
  } finally {
    dev.close();
  }
}

function selftest() {
  const ps = buildPackets(Array.from({ length: 8 }, (_, i): [number, Rgb] => [i, [0xff, 0x80, 0]]));
  assert.deepEqual(ps.map((p) => p.length), [33, 33]);
  assert.deepEqual(ps[0].slice(0, 9), [0, 7, 0, 1, 7, 0, 0xff, 0x80, 0]);
  assert.deepEqual(ps[1].slice(0, 9), [0, 7, 0, 1, 1, 7, 0xff, 0x80, 0]);
  assert.equal(buildPackets(parseKey('all').map((l): [number, Rgb] => [l, [1, 2, 3]])).length, 9);
  assert.equal(parseKey('all').length, 63);
  assert.deepEqual(pad([7, 0, 2]).slice(0, 5), [0, 7, 0, 2, 0]);
  assert.deepEqual([parseKey('SPC'), parseKey('rshift'), parseKey('/'), parseKey('5'), parseKey('20')], [[59], [43], [43], [8], [20]]);
  assert.deepEqual([parseColor('#FF8000'), parseColor('Red'), parseColor('off')], [[255, 128, 0], [255, 0, 0], [0, 0, 0]]);
  for (const bad of ['zzzzzz', 'fff', 'nope']) assert.throws(() => parseColor(bad));
  for (const bad of ['63', 'nope', '']) assert.throws(() => parseKey(bad));
  console.log('ok');
}

async function main(a: string[]) {
  if (a[0] === 'selftest') return selftest();
  if (a[0] === 'keys') return console.log(ROWS.join('\n'));
  if (a[0] === 'clear' && a.length === 1) return send([CLEAR]);
  if (a[0] === 'set' && a.length > 2 && a.length % 2 === 1) {
    const pairs: [number, Rgb][] = [];
    for (let i = 1; i < a.length; i += 2) {
      const keys = a[i] === ',' ? [','] : a[i].split(','); // a bare ',' is the comma key
      const rgb = parseColor(a[i + 1]);
      for (const led of keys.flatMap(parseKey)) pairs.push([led, rgb]);
    }
    return send(buildPackets(pairs));
  }
  throw new Error('usage: node rgbkey.ts set KEY COLOR [KEY COLOR ...] | clear | keys | selftest');
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
