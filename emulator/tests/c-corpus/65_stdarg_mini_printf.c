/* Tries to break va_arg: a small formatter written in C walks its own va_list and must agree with snprintf given the same arguments. */
#include <stdio.h>
#include <stdarg.h>
#include <string.h>

/* Lay out a body inside a field: '-' pads right, '0' pads between the
   sign and the digits, otherwise spaces go on the left. */
static int field(char *o, const char *body, int len, int width, int left, int zero)
{
    int k = 0, pad = width > len ? width - len : 0, s = 0;
    if (zero && !left && len > 0 && body[0] == '-')
        o[k++] = body[s++];
    for (int i = 0; !left && i < pad; i++)
        o[k++] = zero ? '0' : ' ';
    for (int i = s; i < len; i++)
        o[k++] = body[i];
    for (int i = 0; left && i < pad; i++)
        o[k++] = ' ';
    return k;
}

static int digits(char *b, unsigned long v, int neg, unsigned base, int upper)
{
    const char *set = upper ? "0123456789ABCDEF" : "0123456789abcdef";
    char t[24];
    int n = 0, k = 0;
    do {
        t[n++] = set[v % base];
        v /= base;
    } while (v);
    if (neg)
        b[k++] = '-';
    while (n)
        b[k++] = t[--n];
    return k;
}

/* Only for values whose decimal expansion ends within prec places, so
   plain truncation is exact and no rounding rule comes into it. */
static int fixed(char *b, double d, int prec)
{
    unsigned long scale = 1;
    int k = 0;
    if (d < 0) {
        b[k++] = '-';
        d = -d;
    }
    for (int i = 0; i < prec; i++)
        scale *= 10;
    unsigned long all = (unsigned long)(d * (double)scale);
    k += digits(b + k, all / scale, 0, 10, 0);
    if (prec) {
        b[k++] = '.';
        for (unsigned long p = scale / 10; p; p /= 10)
            b[k++] = (char)('0' + all / p % 10);
    }
    return k;
}

static int mini(char *out, const char *fmt, ...) __attribute__((format(printf, 2, 3)));
static int mini(char *out, const char *fmt, ...)
{
    va_list ap;
    int k = 0;
    va_start(ap, fmt);
    for (const char *f = fmt; *f; f++) {
        if (*f != '%') {
            out[k++] = *f;
            continue;
        }
        int left = 0, zero = 0, width = 0, prec = -1, lng = 0, len = 0;
        char body[400];
        for (f++; *f == '-' || *f == '0'; f++) {
            if (*f == '-')
                left = 1;
            else
                zero = 1;
        }
        if (*f == '*') {
            width = va_arg(ap, int);
            if (width < 0) {
                left = 1;
                width = -width;
            }
            f++;
        }
        for (; *f >= '0' && *f <= '9'; f++)
            width = width * 10 + (*f - '0');
        if (*f == '.')
            for (prec = 0, f++; *f >= '0' && *f <= '9'; f++)
                prec = prec * 10 + (*f - '0');
        for (; *f == 'l' || *f == 'z'; f++)
            lng = 1;
        switch (*f) {
        case 'd': case 'i': {
            long v = lng ? va_arg(ap, long) : va_arg(ap, int);
            len = digits(body, v < 0 ? 0UL - (unsigned long)v : (unsigned long)v, v < 0, 10, 0);
            break;
        }
        case 'u': case 'x': case 'X': case 'o': {
            unsigned long v = lng ? va_arg(ap, unsigned long) : va_arg(ap, unsigned);
            len = digits(body, v, 0, *f == 'o' ? 8 : *f == 'u' ? 10 : 16, *f == 'X');
            break;
        }
        case 'c': body[len++] = (char)va_arg(ap, int); zero = 0; break;
        case 's': {
            const char *s = va_arg(ap, const char *);
            while (s[len] && (prec < 0 || len < prec)) {
                body[len] = s[len];
                len++;
            }
            zero = 0;
            break;
        }
        case 'f': len = fixed(body, va_arg(ap, double), prec < 0 ? 6 : prec); break;
        default: body[len++] = *f; break;
        }
        k += field(out + k, body, len, width, left, zero);
    }
    va_end(ap);
    out[k] = '\0';
    return k;
}

static char A[512], B[512];

#define CHECK(...) do { \
        int na = mini(A, __VA_ARGS__); \
        int nb = snprintf(B, sizeof B, __VA_ARGS__); \
        printf("%s %d %d |%s|\n", na == nb && strcmp(A, B) == 0 ? "same" : "DIFF", na, nb, A); \
        if (strcmp(A, B) != 0) printf("     want |%s|\n", B); \
    } while (0)

int main(void)
{
    CHECK("%d %i %u %x %X %o", -5, 17, 4000000000u, 0xbeefu, 0xbeefu, 8u);
    CHECK("%ld %lu %lx %zu %c%c %s|%-6s|%6s", -1234567890123L, 18446744073709551615UL,
          0xfeedfacecafeUL, (size_t)1 << 35, 'o', 'k', "str", "ab", "cd");
    CHECK("%d %d %d %d %d %d %d %d %d %d %d %d", 1, -2, 3, -4, 5, -6, 7, -8, 9, -10, 11, -12);
    CHECK("%.1f %.2f %.3f %.4f %.1f %.2f %.3f %.4f %.1f %.2f %f",
          0.5, -1.25, 0.125, 1024.0625, -7.5, 3.75, -0.375, 2.5625, 100.5, -0.25, 1.5);
    CHECK("%d %.3f %s %ld %.2f %c %u %.1f %x %.4f %d %.2f %lu %.3f %d %.1f %d %.2f",
          1, 0.125, "two", -3L, 4.25, '5', 6u, 7.5, 0x8u, 9.0625, -10, 11.75, 12UL,
          -13.875, 14, 15.5, -16, 17.25);
    CHECK("%5d|%-5d|%05d|%*d|%-*u|%08x|%*s|%-*s|", 42, 42, -42, 7, 99, -6, 5u, 0xabcu,
          4, "z", -3, "y");
    CHECK("%%|%c|%s|%d%%|%.3s|%010.2f|%-9.1f|", '#', "", 100, "truncate", -3.5, 0.5);
    CHECK("%lx %lo %lX %ld", ~0UL, 1UL << 63, 0x0123456789abcdefUL, -9223372036854775807L - 1);

    /* Twenty doubles then twenty ints: both register files overflow and
       the stack holds them in source order. */
    CHECK("%.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f "
          "%.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f "
          "%d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d",
          0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5,
          10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5, 17.5, 18.5, 19.5,
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);
    return 0;
}
