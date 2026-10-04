/* Tries to break va_arg past plain types: __int128 even-register pairs, long double in 16-byte q slots, promotions, va_copy, a va_list passed down, and named args that fill every register. */
#include <stdio.h>
#include <stdarg.h>
#include <string.h>

/* Long double is 128-bit here; only its bytes are touched (through
   memcpy), so no soft-float library call is ever needed. */
static unsigned long show128(const char *tag, const void *p)
{
    unsigned long w[2];
    memcpy(w, p, sizeof w);
    printf(" %s:%016lx%016lx", tag, w[1], w[0]);
    return w[0] ^ w[1];
}

/* Consumes three ints from the caller's list through a pointer, so the
   caller's list moves on past them. */
static int take3(va_list *ap)
{
    int a = va_arg(*ap, int), b = va_arg(*ap, int), c = va_arg(*ap, int);
    return a * 100 + b * 10 + c;
}

static void wide(const char *tags, ...)
{
    va_list ap, again;
    unsigned long sum = 0, check = 0;
    va_start(ap, tags);
    va_copy(again, ap);
    printf("%-18s", tags);
    for (const char *t = tags; *t; t++) {
        switch (*t) {
        case 'q': { __int128 v = va_arg(ap, __int128); sum += show128("q", &v); break; }
        case 'L': { long double v = va_arg(ap, long double); sum += show128("L", &v); break; }
        case 'i': { int v = va_arg(ap, int); printf(" i:%d", v); sum += (unsigned)v; break; }
        case 'c': { signed char v = (signed char)va_arg(ap, int); printf(" c:%d", v); sum += (unsigned char)v; break; }
        case 'd': { double v = va_arg(ap, double); printf(" d:%.17g", v); sum += (unsigned long)(long)(v * 1024); break; }
        case 'T': { int v = take3(&ap); printf(" T:%d", v); sum += (unsigned)v; break; }
        }
    }
    /* Second walk over the copy, reading the same types as raw bits. */
    for (const char *t = tags; *t; t++) {
        unsigned long w[2] = { 0, 0 };
        if (*t == 'q') { __int128 v = va_arg(again, __int128); memcpy(w, &v, 16); }
        else if (*t == 'L') { long double v = va_arg(again, long double); memcpy(w, &v, 16); }
        else if (*t == 'd') { double v = va_arg(again, double); memcpy(w, &v, 8); }
        else if (*t == 'T') { w[0] = (unsigned)take3(&again); }
        else { w[0] = (unsigned)va_arg(again, int); }
        check = (check << 7 | check >> 57) ^ w[0] ^ (w[1] * 3);
    }
    va_end(again);
    va_end(ap);
    printf("\n  sum=%lx check=%016lx\n", sum, check);
}

/* Eight named doubles take d0-d7, so every variadic double lives on the
   stack while the variadic ints still use x1-x7. */
static double fp_full(double a, double b, double c, double d, double e, double f,
                      double g, double h, int n, ...)
{
    va_list ap;
    double s = a + b + c + d + e + f + g + h;
    va_start(ap, n);
    for (int i = 0; i < n; i++) {
        int k = va_arg(ap, int);
        double v = va_arg(ap, double);
        printf(" %d:%g", k, v);
        s += k * v;
    }
    va_end(ap);
    printf("\n  fp_full=%g\n", s);
    return s;
}

/* Eight named longs fill x0-x7 and n itself is on the stack, so the
   variadic longs start right after it there. */
static long gp_full(long a, long b, long c, long d, long e, long f, long g, long h,
                    int n, ...)
{
    va_list ap;
    long s = a + b * 2 + c * 3 + d * 4 + e * 5 + f * 6 + g * 7 + h * 8;
    va_start(ap, n);
    for (int i = 0; i < n; i++) {
        long k = va_arg(ap, long);
        double v = va_arg(ap, double);
        printf(" %ld:%g", k, v);
        s += k * (long)(v * 4);
    }
    va_end(ap);
    printf("\n  gp_full=%ld\n", s);
    return s;
}

int main(void)
{
    __int128 x = ((__int128)0x0123456789abcdefL << 64) | 0xfedcba9876543210UL;
    __int128 y = -(__int128)5;
    signed char sc = -100;
    short sh = -30000;
    float fl = 0.1f;

    /* After x1, the first q rounds up to x2:x3; the second lands on x6:x7. */
    wide("iqiq", 1, x, 2, y);
    wide("qqqqi", x, y, x, y, 3);
    wide("LdL", 1.5L, 2.0, -0.1L);
    /* Nine long doubles: q0-q7, then a 16-byte aligned stack slot after
       an int that left the stack cursor 8 bytes in. */
    wide("iiiiiiiiLLLLLLLLLd", 1, 2, 3, 4, 5, 6, 7, 8,
         1.0L, 2.0L, 3.0L, 4.0L, 5.0L, 6.0L, 7.0L, 8.0L, 9.0L, 0.5);
    /* Promotions: char and short arrive as int, float as double. */
    wide("cidd", sc, sh, fl, (double)fl);
    wide("iTiTd", 9, 1, 2, 3, 8, 4, 5, 6, 0.25);
    wide("TTTi", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

    fp_full(1, 2, 3, 4, 5, 6, 7, 8, 4, 1, 0.5, 2, 0.25, 3, 1.5, 4, -2.0);
    fp_full(0.5, 0, 0, 0, 0, 0, 0, 0.5, 9, 1, 1.0, 2, 2.0, 3, 3.0, 4, 4.0, 5, 5.0,
            6, 6.0, 7, 7.0, 8, 8.0, 9, 9.0);
    gp_full(1, 2, 3, 4, 5, 6, 7, 8, 3, 10L, 0.5, -20L, 1.25, 30L, 2.0);
    gp_full(-1, -2, -3, -4, -5, -6, -7, -8, 10, 1L, 0.25, 2L, 0.5, 3L, 0.75, 4L, 1.0,
            5L, 1.25, 6L, 1.5, 7L, 1.75, 8L, 2.0, 9L, 2.25, 10L, 2.5);
    return 0;
}
