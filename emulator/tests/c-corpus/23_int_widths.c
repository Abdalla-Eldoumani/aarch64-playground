#include <stdio.h>
/* char/short/int/long widths, sign and zero extension, narrowing stores */
int main(void) {
    char c = -1; unsigned char uc = 255;
    short s = -2; unsigned short us = 65535;
    int i = c; int j = uc; int k = s; int l = us;
    printf("%d %d %d %d\n", i, j, k, l);
    long lc = c, luc = uc, ls = s;
    printf("%ld %ld %ld\n", lc, luc, ls);
    int big = 0x12345678;
    char lo = (char)big; short mid = (short)big;
    printf("%d %d %x\n", lo, mid, (unsigned char)big);
    unsigned int u = 0xFFFFFFFFu;
    long fromu = u, fromi = (int)u;
    printf("%ld %ld\n", fromu, fromi);
    char arr[4] = {1, -2, 3, -4};
    int sum = 0;
    for (int n = 0; n < 4; n++) sum += arr[n];
    unsigned char uarr[4] = {1, 254, 3, 252};
    int usum = 0;
    for (int n = 0; n < 4; n++) usum += uarr[n];
    printf("%d %d\n", sum, usum);
    short sh[3] = {-100, 200, -300};
    long t = 0;
    for (int n = 0; n < 3; n++) t += sh[n];
    printf("%ld %d\n", t, (int)sizeof(long) + (int)sizeof(short));
    return 0;
}
