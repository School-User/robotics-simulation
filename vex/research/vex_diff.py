#!/usr/bin/env python3
"""Continuously query CNTR_GET_STATE on ttyACM0 and print payload bytes
whenever they change, so we can correlate with physical stick/button input."""
import serial
import time

PORT = "/dev/ttyACM0"
HEADER = bytes([0xC9, 0x36, 0xB8, 0x4E])
CON_CDC = 0x58
CNTR_GET_STATE = 0x60


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


def query(ser):
    ser.reset_input_buffer()
    ser.write(build_packet())
    ser.flush()
    time.sleep(0.05)
    reply = ser.read(256)
    if len(reply) < 8 or reply[0:2] != bytes([0xAA, 0x55]):
        return None
    # header(2) cmd(1) size(1) ecmd(1) ack(1) payload(n) crc16(2)
    size = reply[3]
    payload = reply[6:6 + (size - 4)]
    return payload


if __name__ == "__main__":
    ser = serial.Serial(PORT, baudrate=115200, timeout=1)
    last = None
    t0 = time.time()
    print("Polling for 15s -- move sticks / press buttons now.")
    while time.time() - t0 < 15:
        p = query(ser)
        if p is not None and p != last:
            print(f"[{time.time()-t0:5.2f}s] {p.hex()}")
            last = p
        time.sleep(0.08)
    ser.close()
