#include <stdio.h>
int main(void){
  int n=-42; unsigned u=3000000000u; long l=-1234567890123L; unsigned long ul=18446744073709551615UL;
  printf("[%d][%5d][%-5d][%05d][%+d][% d]\n", n,n,n,n,n,n);
  printf("[%u][%x][%X][%o][%#x][%#o]\n", u,u,u,u,u,u);
  printf("[%ld][%lu][%lx][%lld][%llu]\n", l,ul,ul,(long long)l,(unsigned long long)ul);
  printf("[%c][%c][%%][%3c][%-3c]\n", 'A', 97, 'z', 'y');
  printf("[%s][%10s][%-10s][%.3s][%.0s][%5.2s]\n", "hello","hi","hi","truncate","gone","abc");
  printf("[%hhd][%hd][%hhu][%hu]\n", (char)200, (short)70000, (unsigned char)200, (unsigned short)70000);
  printf("[%*d][%-*d][%.*d]\n", 6, 7, 6, 7, 4, 7);
  int r = printf("count me\n"); printf("returned %d\n", r);
  printf("%d %d %d %d %d %d %d %d %d %d %d %d\n",1,2,3,4,5,6,7,8,9,10,11,12);
  printf("no newline at end");
  return 0;
}
