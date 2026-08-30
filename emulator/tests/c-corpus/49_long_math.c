#include <stdio.h>
int main(int argc,char**argv){ long a=0x7fffffffffffffffL; long b=argc+2; unsigned long ua=a; 
  printf("%ld %ld %lu %lu %ld %ld\n", a/b, a%b, ua/(unsigned long)b, ua%(unsigned long)b, a*b, -a/b);
  long x=123456789L*b; long y=x*x; printf("%ld %lu %ld\n", y, (unsigned long)y>>7, y<<3);
  int i=-2147483647-1; printf("%d %d %ld\n", i/(int)b, i%(int)b, (long)i*(long)b); return 0; }
