#include <stdio.h>
/* udiv/sdiv/msub, signed vs unsigned comparison, mixed-sign expressions */
int main(void) {
    unsigned int a = 3000000000u, b = 7;
    printf("%u %u\n", a / b, a % b);
    int c = -3000000000 + 2000000000;   /* -1000000000 */
    printf("%d %d %d\n", c / 7, c % 7, c / -7);
    unsigned int x = 5;
    int y = -1;
    printf("%d %d\n", x > y, (int)x > y);
    unsigned char uc = 250;
    uc += 10;
    signed char sc = 120;
    sc += 10;
    printf("%d %d\n", uc, sc);
    long big = -9000000000L;
    printf("%ld %ld\n", big / 1000, big % 1000);
    unsigned long ub = 12345678901234567ul;
    printf("%lu %lu\n", ub / 12345, ub % 12345);
    return 0;
}
