# VEX EXP controller link

`bytetobite.bin` is the program `vex.js` uploads to slot 8 of a visitor's EXP Brain. It prints the
controller as `CTL,lx,ly,rx,ry,a,b,x,y,up,down,left,right,l1,r1` at 50 Hz on the Brain's user serial port.

Source: `bytetobite.cpp`. Rebuild with the VEX EXP SDK (`EXP_20240802_15_00_00`), clang and
`arm-none-eabi-binutils`, using the makefile from VEX's empty EXP C++ template.

The binary links VEX's runtime library, so it is distributed under VEX's Limited License
(`VEX-SDK-license.pdf`): you may not redistribute the VEX software on its own.

Check against a real Brain: `node tests/vex.hardware.mjs /dev/ttyACM0 /dev/ttyACM1`.
