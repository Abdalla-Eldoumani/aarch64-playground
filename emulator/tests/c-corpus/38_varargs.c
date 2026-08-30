#include <stdio.h>
#include <stdarg.h>
long sum(int n, ...){ va_list ap; va_start(ap,n); long s=0; for(int i=0;i<n;i++) s+=va_arg(ap,long); va_end(ap); return s; }
int maxi(int n, ...){ va_list ap; va_start(ap,n); int m=-1000000; for(int i=0;i<n;i++){int v=va_arg(ap,int); if(v>m)m=v;} va_end(ap); return m; }
int main(void){ printf("%ld %ld %d\n", sum(3,1L,2L,3L), sum(12,1L,2L,3L,4L,5L,6L,7L,8L,9L,10L,11L,12L), maxi(10,5,9,-3,7,100,2,3,4,5,6)); return 0; }
