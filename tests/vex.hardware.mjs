// Manual check against a real EXP Brain: node tests/vex.hardware.mjs /dev/ttyACM1 /dev/ttyACM0
// Runs the browser code (vex.js) with Node streams standing in for Web Serial ports.
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { vex } from '../vex.js';

const fakePort = path => ({
  async open() { execFileSync('stty', ['-F', path, 'raw', '-echo']); this.readable = Readable.toWeb(createReadStream(path)); this.writable = Writable.toWeb(createWriteStream(path)); },
});
vex.loadProgram = async () => new Uint8Array(readFileSync(new URL('../vex/bytetobite.bin', import.meta.url)));
vex.onStatus = s => console.log('status:', s);
let n = 0, last;
vex.onState = s => { n++; last = s; };
for (const path of process.argv.slice(2)) { console.log('add', path); await vex.add(fakePort(path)); }
await new Promise(r => setTimeout(r, 1000));
console.log(`final status: ${vex.status}; samples in total: ${n}; last:`, JSON.stringify(last));
console.log(vex.status === 'connected' && n > 20 ? 'PASS' : 'FAIL');
process.kill(process.pid, 'SIGKILL');   // a blocked tty read keeps process.exit from returning
