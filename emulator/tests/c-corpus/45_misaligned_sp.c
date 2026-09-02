#include <stdio.h>
/* misaligns sp across a libc call: SIGBUS on hardware, a bus-error halt here; qemu tolerates it, so regen skips this program's run */
int main(void){ printf("before\n"); __asm__ volatile("sub sp, sp, #8"); printf("during\n"); __asm__ volatile("add sp, sp, #8"); printf("after\n"); return 0; }
