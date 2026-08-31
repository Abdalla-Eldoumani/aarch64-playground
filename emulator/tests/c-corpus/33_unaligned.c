#include <stdio.h>
#include <string.h>
int main(void){
  unsigned char buf[16]; for(int i=0;i<16;i++) buf[i]=i+1;
  int *p=(int*)(buf+1); long *q=(long*)(buf+3); short *h=(short*)(buf+5);
  printf("%08x %016lx %04x\n", *p, *q, (unsigned short)*h);
  *p = 0x11223344; printf("%02x %02x %02x %02x %02x\n", buf[0],buf[1],buf[2],buf[3],buf[4]);
  return 0;
}
