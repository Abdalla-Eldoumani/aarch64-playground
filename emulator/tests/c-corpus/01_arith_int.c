#include <stdio.h>
/* signed and unsigned 32-bit arithmetic, division and remainder signs, shifts */
int main(void) {
    int a = 17, b = -5, c = 100000;
    printf("%d %d %d %d %d\n", a + b, a - b, a * b, a / b, a % b);
    printf("%d %d %d %d\n", b / a, b % a, -a / b, -a % b);
    printf("%d %d\n", c * c, c * 21474);           /* wraps in 32 bits */
    unsigned int u = 4000000000u, v = 3;
    printf("%u %u %u %u\n", u + v, u * v, u / v, u % v);
    printf("%d %d %d\n", a << 3, b >> 1, (int)(u >> 4));
    printf("%d %d %d\n", a > b, a == 17, b != -5);
    int x = 0;
    for (int i = 0; i < 100; i++) x += i * i;
    printf("%d\n", x);
    printf("%d %d\n", 2147483647 + 0, -2147483647 - 1);
    return 0;
}
