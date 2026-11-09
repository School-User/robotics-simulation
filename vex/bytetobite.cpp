// Streams the EXP controller over the Brain's USB "user" serial port, one CSV line per 20 ms:
//   CTL,lx,ly,rx,ry,a,b,x,y,up,down,left,right,l1,r1   (sticks -100..100, buttons 0/1)
// The Byte to Bite site reads this with Web Serial.
#include "vex.h"

using namespace vex;

// Globals on purpose: locals in main() can exhaust the EXP's small stack. printf, not std::cout.
vex::brain      Brain;
vex::controller Controller;

int main() {
    Brain.Screen.printAt(2, 30, "Byte to Bite");
    Brain.Screen.printAt(2, 60, "controller link");

    while (1) {
        // VEX numbering: Axis1/2 = right stick X/Y, Axis3/4 = left stick Y/X.
        printf("CTL,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d\n",
               (int)Controller.Axis4.position(), (int)Controller.Axis3.position(),
               (int)Controller.Axis1.position(), (int)Controller.Axis2.position(),
               Controller.ButtonA.pressing(), Controller.ButtonB.pressing(),
               Controller.ButtonX.pressing(), Controller.ButtonY.pressing(),
               Controller.ButtonUp.pressing(), Controller.ButtonDown.pressing(),
               Controller.ButtonLeft.pressing(), Controller.ButtonRight.pressing(),
               Controller.ButtonL1.pressing(), Controller.ButtonR1.pressing());
        this_thread::sleep_for(20);
    }
}
