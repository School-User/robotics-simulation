#!/usr/bin/env python3
"""Reads the VEX Brain's 'user' serial port (plain printf CSV lines from the
uploaded PROS/VEXcode program: CTL,LX,LY,RX,RY,A,B,X,Y,Up,Down,Left,Right,L1,R1),
rebroadcasts the latest state to any connected browser over a local WebSocket,
and mirrors it onto a virtual uinput gamepad so any app on the system (not just
the browser game) sees a normal joystick device."""
import asyncio
import json
import serial
import websockets
from evdev import UInput, AbsInfo, ecodes as e

PORT = "/dev/ttyACM1"
WS_PORT = 8765

clients = set()
latest = {}

BUTTON_CODES = {
    "a": e.BTN_A, "b": e.BTN_B, "x": e.BTN_X, "y": e.BTN_Y,
    "l1": e.BTN_TL, "r1": e.BTN_TR,
    "up": e.BTN_DPAD_UP, "down": e.BTN_DPAD_DOWN,
    "left": e.BTN_DPAD_LEFT, "right": e.BTN_DPAD_RIGHT,
}
AXIS_CODES = {"lx": e.ABS_X, "ly": e.ABS_Y, "rx": e.ABS_RX, "ry": e.ABS_RY}
AXIS_DEADZONE = 6   # snap noise/drift near center to exactly 0
AXIS_SMOOTHING = 0.85  # EMA weight on each new sample; higher = snappier, lower = smoother
smoothed_axes = {k: 0.0 for k in AXIS_CODES}


def smooth_axis(key: str, raw: int) -> int:
    smoothed_axes[key] += (raw - smoothed_axes[key]) * AXIS_SMOOTHING
    value = round(smoothed_axes[key])
    return 0 if abs(value) < AXIS_DEADZONE else value

def make_uinput():
    abs_info = AbsInfo(value=0, min=-100, max=100, fuzz=2, flat=4, resolution=0)
    capabilities = {
        e.EV_KEY: list(BUTTON_CODES.values()),
        e.EV_ABS: [(code, abs_info) for code in AXIS_CODES.values()],
    }
    return UInput(capabilities, name="VEX EXP Controller (virtual)")


def parse_line(line: str):
    parts = line.strip().split(",")
    if len(parts) != 15 or parts[0] != "CTL":
        return None
    try:
        nums = [int(p) for p in parts[1:]]
    except ValueError:
        return None
    keys = ["lx", "ly", "rx", "ry", "a", "b", "x", "y",
            "up", "down", "left", "right", "l1", "r1"]
    return dict(zip(keys, nums))


async def serial_reader(ui):
    loop = asyncio.get_event_loop()
    while True:
        try:
            ser = serial.Serial(PORT, baudrate=115200, timeout=1)
            while True:
                line = await loop.run_in_executor(None, ser.readline)
                if not line:
                    continue
                state = parse_line(line.decode("ascii", errors="ignore"))
                if state is None:
                    continue
                for key in AXIS_CODES:
                    state[key] = smooth_axis(key, state[key])
                changed = {k: v for k, v in state.items() if latest.get(k) != v}
                latest.update(state)
                for key, code in AXIS_CODES.items():
                    if key in changed:
                        ui.write(e.EV_ABS, code, changed[key])
                for key, code in BUTTON_CODES.items():
                    if key in changed:
                        ui.write(e.EV_KEY, code, changed[key])
                if changed:
                    ui.syn()
                if clients:
                    msg = json.dumps(latest)
                    await asyncio.gather(*(c.send(msg) for c in clients), return_exceptions=True)
        except serial.SerialException as ex:
            print(f"serial error: {ex}, retrying in 1s")
            await asyncio.sleep(1)


async def handler(ws):
    clients.add(ws)
    try:
        if latest:
            await ws.send(json.dumps(latest))
        async for _ in ws:
            pass
    finally:
        clients.discard(ws)


async def main():
    ui = make_uinput()
    print("Virtual gamepad created: 'VEX EXP Controller (virtual)'")
    async with websockets.serve(handler, "localhost", WS_PORT):
        print(f"Bridge running: {PORT} -> ws://localhost:{WS_PORT}")
        try:
            await serial_reader(ui)
        finally:
            ui.close()


if __name__ == "__main__":
    asyncio.run(main())
