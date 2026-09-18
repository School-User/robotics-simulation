/*----------------------------------------------------------------------------*/
/*                                                                            */
/*    Module:       main.cpp                                                  */
/*    Author:       kingphisher                                               */
/*    Created:      9/15/2026, 7:04:53 PM                                     */
/*    Description:  EXP project                                               */
/*                                                                            */
/*----------------------------------------------------------------------------*/
#include "vex.h"

using namespace vex;

vex::brain       Brain;
vex::controller  Controller1;

int main() {

    setvbuf(stdout, NULL, _IONBF, 0);

    int tick = 0;
    while(1) {
        // VEX's axis numbering is not left/right-then-x/y: Axis1/2 = right stick
        // (X/Y), Axis3/4 = left stick (Y/X) -- note the reversed order on the left.
        int lx = Controller1.Axis4.position(percentUnits::pct);
        int ly = Controller1.Axis3.position(percentUnits::pct);
        int rx = Controller1.Axis1.position(percentUnits::pct);
        int ry = Controller1.Axis2.position(percentUnits::pct);
        int a = Controller1.ButtonA.pressing(), b = Controller1.ButtonB.pressing();
        int x = Controller1.ButtonX.pressing(), y = Controller1.ButtonY.pressing();
        int up = Controller1.ButtonUp.pressing(), down = Controller1.ButtonDown.pressing();
        int left = Controller1.ButtonLeft.pressing(), right = Controller1.ButtonRight.pressing();
        int l1 = Controller1.ButtonL1.pressing(), r1 = Controller1.ButtonR1.pressing();

        printf("CTL,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d\n",
            lx, ly, rx, ry, a, b, x, y, up, down, left, right, l1, r1);

        if(tick % 5 == 0){
            Brain.Screen.clearScreen();
            Brain.Screen.setCursor(1, 1);
            Brain.Screen.print("LX %d LY %d RX %d RY %d", lx, ly, rx, ry);
            Brain.Screen.setCursor(2, 1);
            Brain.Screen.print("A%d B%d X%d Y%d U%d D%d L%d R%d L1%d R1%d",
                a, b, x, y, up, down, left, right, l1, r1);
        }
        tick++;

        this_thread::sleep_for(10);
    }

}



