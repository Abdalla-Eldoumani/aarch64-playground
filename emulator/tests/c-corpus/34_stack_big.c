#include <stdio.h>
int depth(int n){ char pad[512]; pad[0]=(char)n; if(n==0) return pad[0]; return depth(n-1)+1; }
int main(int argc,char**argv){
  static int g[100000]; int local[20000]; long sum=0;
  for(int i=0;i<20000;i++) local[i]=i; for(int i=0;i<20000;i++) sum+=local[i];
  for(int i=0;i<100000;i++) g[i]=i&7; for(int i=0;i<100000;i++) sum+=g[i];
  printf("%ld %d\n", sum, depth(3000));
  return 0;
}
