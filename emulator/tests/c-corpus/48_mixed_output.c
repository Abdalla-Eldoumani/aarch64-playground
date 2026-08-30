#include <stdio.h>
int main(void){ printf("a"); putchar('b'); puts("c"); fprintf(stdout,"d%d",1); fprintf(stderr,"ERR\n"); printf("\n"); putchar('x'); return 3; }
