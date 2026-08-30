#include <stdio.h>
int main(void){ printf("before\n"); __asm__ volatile("sub sp, sp, #8"); printf("during\n"); __asm__ volatile("add sp, sp, #8"); printf("after\n"); return 0; }
