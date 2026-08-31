#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>
int main(void){ char buf[64]; char s[64]="abc";
  strcat(s,"def"); strncpy(buf,s,3); buf[3]=0; printf("%s %s %d %d\n", s, buf, strncmp("abcd","abce",3), memcmp("ab","ac",2));
  printf("%s %s\n", strchr(s,'d'), strstr(s,"cde")); sprintf(buf,"%d-%s",42,"x"); printf("%s\n", buf); snprintf(buf,4,"%s","toolong"); printf("%s\n", buf);
  printf("%ld %d %d %d\n", strtol("  -123xyz",NULL,10), atoi("12abc"), abs(-5), (int)labs(-6L));
  int *z=calloc(4,sizeof(int)); printf("%d\n", z[3]); z=realloc(z,8*sizeof(int)); z[7]=9; printf("%d\n", z[7]); free(z);
  printf("%c %c %d %d %d\n", toupper('a'), tolower('Q'), isdigit('7'), isalpha('7'), isspace(' '));
  char m[8]="abcdef"; memmove(m+1,m,5); printf("%s\n", m); char *tok=strtok(s,"c"); printf("%s|%s\n", tok, strtok(NULL,"c"));
  fputs("fputs line\n", stdout); fflush(stdout); char line[32]; if(fgets(line,32,stdin)) printf("got %s", line); puts("puts line"); return 0; }
