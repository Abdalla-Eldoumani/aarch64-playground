#include <stdio.h>
/* 64-bit arithmetic, %ld %lu %lx, mixed widths */
int main(void) {
    long a = 123456789012L, b = -987654321L;
    printf("%ld %ld %ld %ld %ld\n", a + b, a - b, a * 7, a / b, a % b);
    unsigned long u = 18446744073709551615UL;
    printf("%lu %lx %lu\n", u, u, u / 3);
    long p = 1;
    for (int i = 0; i < 40; i++) p *= 3;
    printf("%ld\n", p);
    int small = -3;
    long widened = small;
    unsigned int us = 0xFFFFFFF0u;
    unsigned long ul = us;
    printf("%ld %lu %lx\n", widened, ul, (unsigned long)small);
    printf("%ld %ld\n", (long)1 << 40, ((long)1 << 62) / 3);
    return 0;
}
