#include <stdio.h>
typedef int (*cmp)(int,int);
int asc(int a,int b){return a-b;} int desc(int a,int b){return b-a;}
void sort(int*a,int n,cmp f){ for(int i=0;i<n;i++) for(int j=i+1;j<n;j++) if(f(a[i],a[j])>0){int t=a[i];a[i]=a[j];a[j]=t;} }
int main(void){ int a[8]={5,3,9,1,7,2,8,6}; cmp fs[2]={asc,desc}; for(int k=0;k<2;k++){ sort(a,8,fs[k]); for(int i=0;i<8;i++) printf("%d ",a[i]); printf("\n"); } return 0; }
