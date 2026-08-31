#include <stdio.h>
#include <math.h>
int main(int argc,char**argv){ double d=3.14159*argc; float f=2.5f*argc; int i=(int)(d*2); double n=-2.5*argc;
  printf("%f %.2f %e %g %d %d %d\n", d, d, d, d, i, (int)n, (int)(n-0.6));
  printf("%.3f %.3f %.1f %ld\n", sqrt(2.0*argc), pow(2.0,10.0*argc), floor(n), (long)(f*4));
  printf("%f %f %d\n", f, (double)f/3, d>f); return 0; }
