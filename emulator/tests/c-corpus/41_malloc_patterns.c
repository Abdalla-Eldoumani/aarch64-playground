#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(void){ int *a=malloc(0); printf("m0 %s\n", a?"nonnull":"null");
  char *b=malloc(1<<20); memset(b,7,1<<20); long s=0; for(int i=0;i<(1<<20);i+=4096) s+=b[i]; printf("big %ld\n", s);
  int *c=malloc(16*sizeof(int)); for(int i=0;i<16;i++)c[i]=i*i; free(b); int *d=malloc(64); for(int i=0;i<16;i++)d[i]=0; printf("c15=%d\n", c[15]);
  free(c); free(d); free(NULL); char *e=malloc(10); strcpy(e,"nine char"); printf("%s %d\n", e, (int)strlen(e)); free(e);
  void *blocks[100]; for(int i=0;i<100;i++){blocks[i]=malloc(100+i); memset(blocks[i],i,100+i);} int ok=1; for(int i=0;i<100;i++){ if(((unsigned char*)blocks[i])[99]!=i) ok=0; free(blocks[i]);} printf("ok=%d\n",ok); return 0; }
