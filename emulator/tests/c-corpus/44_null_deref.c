#include <stdio.h>
int main(int argc,char**argv){ printf("before\n"); int *p=(int*)(long)(argc-1); printf("%d\n", *p); printf("after\n"); return 0; }
