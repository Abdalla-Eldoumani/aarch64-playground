#include <stdio.h>
/* and/or/xor/not, shifts, popcount, bit reverse, masks, rotate */
int popcount(unsigned int x) { int c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
unsigned int reverse_bits(unsigned int x) {
    unsigned int r = 0;
    for (int i = 0; i < 32; i++) { r = (r << 1) | (x & 1); x >>= 1; }
    return r;
}
unsigned int rotl(unsigned int x, int k) { return (x << k) | (x >> (32 - k)); }
int main(void) {
    unsigned int a = 0xF0F0F0F0u, b = 0x12345678u;
    printf("%x %x %x %x\n", a & b, a | b, a ^ b, ~a);
    printf("%d %d %d\n", popcount(a), popcount(b), popcount(0));
    printf("%x %x\n", reverse_bits(b), rotl(b, 8));
    printf("%x %x %x\n", b << 5, b >> 5, (int)b >> 28);
    int neg = -16;
    printf("%d %d %x\n", neg >> 2, neg << 2, (unsigned int)neg >> 28);
    unsigned long big = 0x0123456789ABCDEFul;
    printf("%lx %lx %lx\n", big << 12, big >> 12, big & 0xFFFF0000FFFF0000ul);
    printf("%d %d\n", (b & (1u << 4)) != 0, (b & (1u << 5)) != 0);
    return 0;
}
