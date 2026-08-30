#include <stdio.h>
int main(int argc,char**argv){
  int z = argc - 1; int n = 42; unsigned un = 42u; long ln = 42L;
  printf("%d %d %u %u %ld %ld\n", n/z, n%z, un/(unsigned)z, un%(unsigned)z, ln/(long)z, ln%(long)z);
  return 0;
}
