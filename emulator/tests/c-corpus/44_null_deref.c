#include <stdio.h>
/* dereferences NULL: SIGSEGV on hardware, the playground's segmentation-fault halt here */
int main(int argc,char**argv){ printf("before\n"); int *p=(int*)(long)(argc-1); printf("%d\n", *p); printf("after\n"); return 0; }
