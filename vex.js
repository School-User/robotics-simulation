// VEX EXP Brain over Web Serial (Chrome/Edge). Uploads a tiny program to the Brain (slot 8) that
// prints the controller as CSV lines, then reads that stream. No install needed on the visitor's side.
//
// The Brain shows up as TWO serial ports: "system" (answers CDC2 packets, used for the upload) and
// "user" (the program's printf output). The browser can't tell them apart, so we probe each one.
// Protocol reference: tools/upload.py in the vex-brain project (ported from vexide/vex-v5-serial).

const ACK = 0x76, SYS_FLAGS = 0x20, FILE_INIT = 0x11, FILE_EXIT = 0x12, FILE_WRITE = 0x13;
const LOAD_ADDR = 0x3800000;   // EXP rejects the program at exit (NACK 0xD3) with any other address
const SLOT = 8;                // last slot: least likely to hold the visitor's own program
export const VEX_USB_VENDOR = 0x2888;

export function crc16(data) {  // CRC-16/XMODEM
  let c = 0;
  for (const b of data) { c ^= b << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xFFFF; }
  return c;
}
export function crc32(data) {  // poly 04C11DB7, init 0, not reflected, no final xor
  let c = 0;
  for (const b of data) { c ^= b << 24; for (let i = 0; i < 8; i++) c = c & 0x80000000 ? (c << 1) ^ 0x04C11DB7 : c << 1; }
  return c >>> 0;
}
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const u32 = (...vals) => { const b = new Uint8Array(vals.length * 4), v = new DataView(b.buffer); vals.forEach((x, i) => v.setUint32(i * 4, x, true)); return b; };
const ascii = (s, len) => { const b = new Uint8Array(len); b.set(new TextEncoder().encode(s)); return b; };

// Command: C9 36 B8 47, cmd 0x56, ecmd, VarU16(payload length), payload, CRC16 (big-endian) of all of it.
export function frame(ecmd, payload = new Uint8Array(0)) {
  const n = payload.length, len = n < 0x80 ? [n] : [(n >> 8) | 0x80, n & 0xFF];
  const body = cat([0xC9, 0x36, 0xB8, 0x47, 0x56, ecmd], len, payload), c = crc16(body);
  return cat(body, [c >> 8, c & 0xFF]);
}
// Reply: AA 55, cmd, VarU16(size), ecmd, ack, payload, CRC16. Returns null until a whole valid packet is in buf.
export function parseReply(buf) {
  let i = 0;
  while (i < buf.length - 1 && !(buf[i] === 0xAA && buf[i + 1] === 0x55)) i++;
  if (buf.length < i + 5) return null;
  const wide = buf[i + 3] >= 0x80, size = wide ? ((buf[i + 3] & 0x7F) << 8) | buf[i + 4] : buf[i + 3], hdr = wide ? 5 : 4;
  if (size < 4 || buf.length < i + hdr + size) return null;
  const pkt = buf.subarray(i, i + hdr + size);
  if (crc16(pkt.subarray(0, -2)) !== ((pkt[pkt.length - 2] << 8) | pkt[pkt.length - 1])) return null;
  return { ecmd: pkt[hdr], ack: pkt[hdr + 1], payload: pkt.slice(hdr + 2, -2) };
}
const KEYS = ['lx', 'ly', 'rx', 'ry', 'a', 'b', 'x', 'y', 'up', 'down', 'left', 'right', 'l1', 'r1'];
// "CTL,lx,ly,rx,ry,a,b,x,y,up,down,left,right,l1,r1" -> {lx:..} (sticks -100..100, buttons 0/1), or null.
export function parseLine(line) {
  const p = line.trim().split(',');
  if (p.length !== 15 || p[0] !== 'CTL') return null;
  const s = {};
  for (let i = 0; i < 14; i++) { const v = Number(p[i + 1]); if (!Number.isInteger(v) || v < -100 || v > 100) return null; s[KEYS[i]] = v; }
  return s;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export const vex = {
  onState: () => {},            // called with every controller sample
  onStatus: () => {},           // 'need-port' | 'need-other-port' | 'uploading' | 'connected' | 'lost' | 'error: ...'
  status: 'need-port',
  loadProgram: async () => new Uint8Array(await (await fetch(new URL('./vex/bytetobite.bin', import.meta.url))).arrayBuffer()),
  supported: () => typeof navigator !== 'undefined' && 'serial' in navigator,
  sys: null, user: null, _open: new Set(),

  _set(s) { this.status = s; this.onStatus(s); },

  // Start reading a port. Everything read lands in w.buf (for CDC2 replies) and is also split into CSV lines.
  _wrap(port) {
    const w = { port, buf: new Uint8Array(0), lines: 0, wake: null };
    (async () => {
      const reader = port.readable.getReader(), dec = new TextDecoder();
      let text = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          w.buf = w.buf.length > 65536 ? value : cat(w.buf, value);
          text += dec.decode(value, { stream: true });
          for (let i; (i = text.indexOf('\n')) >= 0; text = text.slice(i + 1)) {
            const s = parseLine(text.slice(0, i));
            if (s) { w.lines++; this.onState(s); }
          }
          if (text.length > 4096) text = '';
          w.wake?.();
        }
      } catch {}
      // Unplugged or closed: forget the port and release every control.
      this._open.delete(port);
      if (this.sys === w) this.sys = null;
      if (this.user === w) { this.user = null; this.onState(Object.fromEntries(KEYS.map(k => [k, 0]))); this._set('lost'); }
    })();
    return w;
  },

  async _handshake(w, ecmd, payload, timeout = 500, tries = 3) {
    for (let t = 0; t < tries; t++) {
      w.buf = new Uint8Array(0);
      const wr = w.port.writable.getWriter();
      try { await wr.write(frame(ecmd, payload)); } finally { wr.releaseLock(); }
      for (const end = Date.now() + timeout; ;) {
        const r = parseReply(w.buf);
        if (r && r.ecmd === ecmd) { if (r.ack !== ACK) throw new Error(`Brain refused (0x${r.ack.toString(16)})`); return r.payload; }
        const left = end - Date.now();
        if (left <= 0) break;
        await new Promise(res => { w.wake = res; setTimeout(res, left); });
      }
    }
    throw new Error('Brain did not answer');
  },
  async _streaming(w, ms = 400) { const n = w.lines; await sleep(ms); return w.lines > n; },

  async _uploadFile(name, data, addr, exitAction) {
    const meta = cat(ascii(name.split('.').pop(), 4), u32(Math.floor(Date.now() / 1000) - 946684800), [1, 0, 0, 0]);
    // op=write, target=flash, vendor=user, options=overwrite
    const init = cat([1, 1, 1, 1], u32(data.length, addr, crc32(data)), meta, ascii(name, 24));
    const reply = await this._handshake(this.sys, FILE_INIT, init);
    const win = reply[0] | (reply[1] << 8), chunk = win > 0 && win <= 4096 ? win : 4096;
    for (let off = 0; off < data.length; off += chunk) {
      const part = data.subarray(off, off + chunk);
      await this._handshake(this.sys, FILE_WRITE, cat(u32(addr + off), part, new Uint8Array(-part.length & 3)));  // 4-byte aligned
    }
    await this._handshake(this.sys, FILE_EXIT, [exitAction], 1000);
  },

  // Open + classify one port, then connect if we now have what we need.
  async add(port) {
    if (!this._open.has(port)) {
      await port.open({ baudRate: 115200 });
      this._open.add(port);
      const w = this._wrap(port);
      if (await this._streaming(w)) this.user = w;                       // program already running
      else if (await this._handshake(w, SYS_FLAGS, [], 300, 2).then(() => true, () => false)) this.sys = w;
      else this.user = w;                                                // silent and not the system port
    }
    return this._go();
  },
  async _go() {
    try {
      if (this.user && await this._streaming(this.user)) return this._set('connected');
      if (!this.sys || !this.user) return this._set(this.sys || this.user ? 'need-other-port' : 'need-port');
      this._set('uploading');
      const ini = `[project]\nide=VEXcode\n[program]\nname=Byte to Bite\nslot=${SLOT - 1}\nicon=cool-x\niconalt=\ndescription=Controller link for the Byte to Bite website`;
      await this._uploadFile(`slot_${SLOT}.ini`, new TextEncoder().encode(ini), 0, 0);
      await this._uploadFile(`slot_${SLOT}.bin`, await this.loadProgram(), LOAD_ADDR, 1);   // 1 = run it
      this._set(await this._streaming(this.user, 1500) ? 'connected' : 'error: program did not start');
    } catch (e) { this._set('error: ' + e.message); }
  },

  // Button click: let the visitor pick a VEX port (they pick twice, once per port).
  async request() {
    try { await this.add(await navigator.serial.requestPort({ filters: [{ usbVendorId: VEX_USB_VENDOR }] })); }
    catch (e) { if (e.name !== 'NotFoundError') this._set('error: ' + e.message); }   // NotFoundError = picker cancelled
  },
  // Page load: reuse ports the visitor already allowed.
  async resume() {
    if (!this.supported()) return;
    for (const p of await navigator.serial.getPorts()) if (p.getInfo().usbVendorId === VEX_USB_VENDOR) await this.add(p).catch(() => {});
  },
};
