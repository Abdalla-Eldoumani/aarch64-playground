#include <stdio.h>
/* recurses with no base case: SIGSEGV on hardware, a stack-overflow halt here */
long rec(long n){ volatile char pad[1024]; pad[0]=1; return rec(n+1)+pad[0]; }
int main(void){ printf("start\n"); printf("%ld\n", rec(0)); return 0; }
