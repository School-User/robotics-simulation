import assert from 'node:assert/strict';
import { crc16, crc32, frame, parseReply, parseLine } from '../vex.js';

const hex = b => Buffer.from(b).toString('hex');
const bytes = h => Uint8Array.from(Buffer.from(h, 'hex'));
const check = new TextEncoder().encode('123456789');

assert.equal(crc16(check), 0x31C3);                       // CRC-16/XMODEM check value
assert.equal(crc32(check), 0x89A1897F);                   // VEX CRC32 check value (vex-cdc crc.rs)
assert.equal(hex(frame(0x20)), 'c936b847562000069e');     // SYS_FLAGS frame a real EXP Brain ACKed
assert.equal(frame(0x13, new Uint8Array(200)).length, 6 + 2 + 200 + 2);   // 2-byte length above 127

// A real EXP Brain reply to SYS_FLAGS, also with junk in front and split mid-packet.
const reply = 'aa55560b2076050211000d0d0019a7';
assert.deepEqual({ ...parseReply(bytes(reply)), payload: hex(parseReply(bytes(reply)).payload) }, { ecmd: 0x20, ack: 0x76, payload: '050211000d0d00' });
assert.equal(parseReply(bytes('0d0a' + reply)).ack, 0x76);
assert.equal(parseReply(bytes(reply.slice(0, 20))), null);
assert.equal(parseReply(bytes(reply.slice(0, -2) + '0000')), null);   // bad CRC

assert.deepEqual(parseLine('CTL,-100,79,0,5,1,0,0,0,0,0,0,0,0,1\r'), { lx: -100, ly: 79, rx: 0, ry: 5, a: 1, b: 0, x: 0, y: 0, up: 0, down: 0, left: 0, right: 0, l1: 0, r1: 1 });
assert.equal(parseLine('CTL,1,2,3'), null);
assert.equal(parseLine('CTL,999,0,0,0,0,0,0,0,0,0,0,0,0,0'), null);
assert.equal(parseLine('hello'), null);
console.log('vex.test ok');
