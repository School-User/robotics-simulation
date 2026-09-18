#!/usr/bin/env python3
"""Probe script: send CDC2 CNTR_GET_STATE queries to a VEX EXP controller
over both ttyACM ports and both known header variants, dump raw replies."""
import serial
import time
import sys

PORTS = ["/dev/ttyACM0", "/dev/ttyACM1"]
HEADERS = [
    bytes([0xC9, 0x36, 0xB8, 0x47]),  # standard
    bytes([0xC9, 0x36, 0xB8, 0x4E]),  # alt (comment says controller may use 0x4e)
]
CON_CDC = 0x58
CNTR_GET_STATE = 0x60


def crc16_xmodem(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc


def build_packet(header: bytes, cmd: int, ecmd: int, payload: bytes) -> bytes:
    # size field covers payload + crc16 (2 bytes), VarU16: values <=0x7F are 1 byte,
    # otherwise 2 bytes with high bit set on first byte (per vex-cdc varint.rs convention)
    size_val = len(payload) + 2
    if size_val <= 0x7F:
        size_bytes = bytes([size_val])
    else:
        size_bytes = bytes([0x80 | (size_val >> 8), size_val & 0xFF])
    body = header + bytes([cmd, ecmd]) + size_bytes + payload
    crc = crc16_xmodem(body)
    return body + bytes([(crc >> 8) & 0xFF, crc & 0xFF])


def probe(port: str):
    print(f"\n=== {port} ===")
    try:
        ser = serial.Serial(port, baudrate=115200, timeout=1.5)
    except Exception as e:
        print(f"  open failed: {e}")
        return
    # passive listen first
    ser.reset_input_buffer()
    time.sleep(0.5)
    idle = ser.read(256)
    print(f"  idle bytes ({len(idle)}): {idle.hex()}")

    for header in HEADERS:
        pkt = build_packet(header, CON_CDC, CNTR_GET_STATE, b"")
        print(f"  sending (header={header.hex()}): {pkt.hex()}")
        ser.reset_input_buffer()
        ser.write(pkt)
        ser.flush()
        time.sleep(0.3)
        reply = ser.read(256)
        print(f"  reply ({len(reply)}): {reply.hex()}")
    ser.close()


if __name__ == "__main__":
    for p in PORTS:
        probe(p)
