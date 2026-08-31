#include <stdio.h>
int zeroed[10]; static long szero; const int rc=7; const char *lit="same"; static const char arr[]="rodata";
int main(void){ const char *lit2="same"; printf("%d %ld %d %s %s %d\n", zeroed[9], szero, rc, lit, arr, lit==lit2); zeroed[3]=4; printf("%d %d\n", zeroed[3], zeroed[4]); return 0; }
