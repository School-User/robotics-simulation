# VEX EXP controller link

`bytetobite.bin` is the program `vex.js` uploads to slot 8 of a visitor's EXP Brain. It prints the
controller as `CTL,lx,ly,rx,ry,a,b,x,y,up,down,left,right,l1,r1` at 50 Hz on the Brain's user serial port.

Source: `bytetobite.cpp`. Rebuild with the VEX EXP SDK (`EXP_20240802_15_00_00`), clang and
`arm-none-eabi-binutils`, using the makefile from VEX's empty EXP C++ template.

The binary links VEX's runtime library, so it is distributed under VEX's Limited License
(`VEX-SDK-license.pdf`): you may not redistribute the VEX software on its own.

Check against a real Brain: `node tests/vex.hardware.mjs /dev/ttyACM0 /dev/ttyACM1`.

## Error codes shown on the page

| Code | Meaning |
|---|---|
| V00 | Unexpected browser error (the message follows the code) |
| V01 | Browser has no Web Serial (not Chrome/Edge, or a phone) |
| V02 | Port could not be opened: another tab or VEXcode is using the Brain, or no permission (Linux) |
| V03 | Brain did not answer: cable, power, or the wrong device |
| V04-xx | Brain refused the upload; `xx` is the Brain's own refusal byte (e.g. `d3` = invalid program) |
| V05 | Program uploaded but no controller data arrived |
| V06 | The page could not download `bytetobite.bin` |
| V07 | Brain unplugged or turned off while connected |
