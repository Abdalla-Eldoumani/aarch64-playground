#include <stdio.h>
const char* name(int k){ switch(k){case 0:return "zero";case 1:return "one";case 2:return "two";case 3:return "three";case 4:return "four";case 5:return "five";case 6:return "six";case 7:return "seven";case 8:return "eight";case 9:return "nine";case 10:return "ten";case 11:return "eleven";default:return "many";} }
int main(void){ for(int i=-1;i<14;i++) printf("%d=%s ", i, name(i)); printf("\n"); return 0; }
