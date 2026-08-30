#include <stdio.h>
int main(void){ int c, n=0, lines=0, last=-1; while((c=getchar())!=EOF){ n++; if(c=='\n') lines++; last=c; }
  printf("chars=%d lines=%d last=%d\n", n, lines, last); int c2=getchar(); printf("after eof=%d\n", c2); return 0; }
