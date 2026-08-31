#include <stdio.h>
int main(int argc,char**argv){
  char c = 200; signed char sc = 200; unsigned char uc=200;
  printf("char=%d signed=%d unsigned=%d\n", c, sc, uc);
  int s = argc + 30; /* 31 */ int big = argc + 32; /* 33 */
  unsigned v = 0x80000000u; int iv = -8;
  printf("%u %u %d %d\n", v>>s, 1u<<s, iv>>argc, iv>>3);
  printf("%u\n", v>>(big&31));
  long lv = -1L; printf("%ld %lu\n", lv>>63, ((unsigned long)lv)>>63);
  int m = 2147483647; m = m + argc; printf("wrap=%d\n", m);
  unsigned um = 0; um = um - argc; printf("uwrap=%u\n", um);
  int neg=-7, d=argc+1; printf("%d %d %d %d\n", neg/d, neg%d, -neg/d, -neg%d);
  return 0;
}
