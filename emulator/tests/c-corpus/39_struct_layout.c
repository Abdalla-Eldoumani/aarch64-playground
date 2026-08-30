#include <stdio.h>
#include <stddef.h>
struct A{char c; int i; char d; long l; short s;}; struct B{char a; char b; short s;} __attribute__((packed)) ; struct C{unsigned x:3; unsigned y:5; unsigned z:9;};
struct Big{long a,b,c,d; int e;};
struct Big mk(long k){ struct Big b={k,k+1,k+2,k+3,(int)k+4}; return b; }
long tot(struct Big b){ return b.a+b.b+b.c+b.d+b.e; }
int main(void){ struct C c={5,17,300}; printf("%zu %zu %zu %zu %zu\n", sizeof(struct A), offsetof(struct A,l), sizeof(struct B), sizeof(struct C), sizeof(struct Big));
  printf("%u %u %u\n", c.x,c.y,c.z); c.z=511; c.x=9; printf("%u %u\n", c.x, c.z);
  struct Big b=mk(10); printf("%ld %ld\n", tot(b), tot(mk(-3))); return 0; }
