#!/usr/bin/env python3
"""Phased capture v2: careful send/drain/read to avoid delayed-reply misalignment."""
import serial
import time

PORT = "/dev/ttyACM0"
HEADER = bytes([0xC9, 0x36, 0xB8, 0x4E])
CON_CDC = 0x58
CNTR_GET_STATE = 0x60

PHASES = [
    ("BASELINE - don't touch anything", 3),
    ("PUSH LEFT STICK ALL THE WAY UP, hold it", 3),
    ("release, don't touch anything", 2),
    ("PUSH LEFT STICK ALL THE WAY DOWN, hold it", 3),
    ("release, don't touch anything", 2),
    ("PUSH LEFT STICK ALL THE WAY LEFT, hold it", 3),
    ("release, don't touch anything", 2),
    ("PUSH LEFT STICK ALL THE WAY RIGHT, hold it", 3),
    ("release, don't touch anything", 2),
    ("PRESS AND HOLD BUTTON A", 3),
    ("release, don't touch anything", 2),
    ("PRESS AND HOLD LEFT SHOULDER BUTTON (L1)", 3),
    ("release, don't touch anything", 2),
]


def crc16_xmodem(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc


def build_packet(payload: bytes = b"") -> bytes:
    size_val = len(payload) + 2
    size_bytes = bytes([size_val]) if size_val <= 0x7F else bytes([0x80 | (size_val >> 8), size_val & 0xFF])
    body = HEADER + bytes([CON_CDC, CNTR_GET_STATE]) + size_bytes + payload
    crc = crc16_xmodem(body)
    return body + bytes([(crc >> 8) & 0xFF, crc & 0xFF])


def drain(ser):
    ser.timeout = 0.05
    while ser.read(256):
        pass


def query(ser):
    drain(ser)  # fully clear any stale/late bytes before sending
    ser.write(build_packet())
    ser.flush()
    ser.timeout = 0.3
    # header(2)+cmd(1)+size(1) = 4 bytes minimum to know full length
    head = ser.read(4)
    if len(head) < 4 or head[0:2] != bytes([0xAA, 0x55]):
        return None
    size = head[3]
    rest = ser.read(size)
    if len(rest) < size:
        return None
    # rest = ecmd(1) + ack(1) + payload(n) + crc16(2)
    return rest[2:-2]


if __name__ == "__main__":
    ser = serial.Serial(PORT, baudrate=115200, timeout=1)
    drain(ser)
    for label, dur in PHASES:
        print(f"\n>>> {label} ({dur}s)")
        seen = {}
        t0 = time.time()
        while time.time() - t0 < dur:
            p = query(ser)
            if p is not None:
                seen[p.hex()] = seen.get(p.hex(), 0) + 1
            time.sleep(0.1)
        for val, count in sorted(seen.items(), key=lambda kv: -kv[1]):
            print(f"    {val}  (x{count})")
    ser.close()
