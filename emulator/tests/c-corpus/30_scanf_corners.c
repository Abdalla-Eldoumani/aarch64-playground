#include <stdio.h>
int main(void){
  int a,b; char c; char w[32]; unsigned x; long L; int r;
  r=scanf("%d%d",&a,&b); printf("r=%d a=%d b=%d\n",r,a,b);
  r=scanf(" %c",&c); printf("r=%d c=%c\n",r,c);
  r=scanf("%31s",w); printf("r=%d w=%s\n",r,w);
  r=scanf("%x",&x); printf("r=%d x=%u\n",r,x);
  r=scanf("%ld",&L); printf("r=%d L=%ld\n",r,L);
  r=scanf("%3d",&a); printf("r=%d a=%d\n",r,a);
  r=scanf("%d",&a); printf("r=%d (expect 0, junk)\n",r);
  r=scanf("%s",w); printf("r=%d w=%s\n",r,w);
  r=scanf("%d",&a); printf("r=%d (expect -1 EOF)\n",r);
  return 0;
}
