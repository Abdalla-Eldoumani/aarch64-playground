#include <stdio.h>
/* recursion, many arguments (register + stack spill), callee-saved pressure */
long fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }
int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
int ack(int m, int n) {
    if (m == 0) return n + 1;
    if (n == 0) return ack(m - 1, 1);
    return ack(m - 1, ack(m, n - 1));
}
long sum10(int a, int b, int c, int d, int e, int f, int g, int h, int i, int j) {
    return (long)a + b + c + d + e + f + g + h + i + j;
}
int mix(int a, long b, char c, short d, int e, long f, int g, int h, int i, long j, int k) {
    return a + (int)b + c + d + e + (int)f + g + h + i + (int)j + k;
}
int pressure(int n) {
    int a = n, b = n + 1, c = n + 2, d = n + 3, e = n + 4, f = n + 5, g = n + 6, h = n + 7;
    for (int i = 0; i < 10; i++) { a += b; b += c; c += d; d += e; e += f; f += g; g += h; h += a; }
    return a ^ b ^ c ^ d ^ e ^ f ^ g ^ h;
}
int main(void) {
    printf("%ld %ld\n", fact(10), fact(20));
    printf("%d %d\n", fib(20), ack(2, 3));
    printf("%ld\n", sum10(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    printf("%d\n", mix(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11));
    printf("%d\n", pressure(3));
    return 0;
}
