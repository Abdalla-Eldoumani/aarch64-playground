/* Tries to break printf length modifiers: hh h l ll z j t narrow or widen the same 64 bits, read from registers and from stack slots. */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

/* 25 varargs: the first seven ride in x1..x7, the rest spill to the
   stack, so every modifier is read from both places across the calls. */
static void show(unsigned long v)
{
    int r = printf("hh %hhd %hhu %hhx %hho | h %hd %hu %hX %ho\n"
                   " int %d %u %x %o | long %ld %lu %lx\n"
                   " ll %lld %llX | z %zu %zx %zd | j %jd %ju %jx | t %td %ti\n",
                   (signed char)v, (unsigned char)v, (unsigned char)v, (unsigned char)v,
                   (short)v, (unsigned short)v, (unsigned short)v, (unsigned short)v,
                   (int)v, (unsigned)v, (unsigned)v, (unsigned)v,
                   (long)v, v, v,
                   (long long)v, (unsigned long long)v,
                   (size_t)v, (size_t)v, (ssize_t)v,
                   (intmax_t)v, (uintmax_t)v, (uintmax_t)v,
                   (ptrdiff_t)v, (ptrdiff_t)v);
    printf(" r=%d\n", r);
}

/* hh and h take a promoted int and convert it down before printing, so
   an int outside the char or short range must wrap, not print whole. */
static void narrow(int v)
{
    int r = printf("narrow %d: %hhd %hhu %hhx %hd %hu %hx\n",
                   v, v, (unsigned)v, (unsigned)v, v, (unsigned)v, (unsigned)v);
    printf(" r=%d\n", r);
}

int main(void)
{
    static const unsigned long vals[] = {
        0x8182838485868788UL, 0x7f7f7f7f7f7f7f7fUL, 0x0000000100000000UL,
        0xffffffffffffffffUL, 0x00000000ffffffffUL, 0x8000000000000000UL,
        0x00ff00ff00ff00ffUL, 0x0000010000000080UL,
    };
    for (unsigned i = 0; i < sizeof vals / sizeof vals[0]; i++) {
        printf("v=%#018lx\n", vals[i]);
        show(vals[i]);
    }

    /* A running hash gives values whose every byte differs. */
    unsigned long h = 0xcbf29ce484222325UL;
    for (int i = 0; i < 6; i++) {
        h = (h ^ (unsigned long)(i * 131 + 7)) * 0x100000001b3UL;
        printf("h%d=%lx\n", i, h);
        show(h);
    }

    static const int nv[] = { 127, 128, 255, 256, -129, 32767, 32768, 65535, 65536, -40000 };
    for (unsigned i = 0; i < sizeof nv / sizeof nv[0]; i++)
        narrow(nv[i]);

    /* size_t and friends are 64 bits here: 1 << 40 must not print 0. */
    volatile int shift = 40;
    size_t big = (size_t)1 << shift;
    ssize_t neg = -(ssize_t)big - 5;
    int r = printf("%zu %zx %zX %zo %zd %zi\n", big, big, big, big, neg, neg);
    printf("r=%d\n", r);
    r = printf("%jd %ju %td %lld %llu\n", (intmax_t)neg, (uintmax_t)neg,
               (ptrdiff_t)neg, (long long)neg, (unsigned long long)neg);
    printf("r=%d\n", r);
    /* The same widths with flags, width, and precision layered on. */
    r = printf("[%-+22zd][%#24zx][%026jd][%.20tu][% hhd][%+hd]\n",
               neg, big, (intmax_t)neg, (size_t)big, (signed char)-5, (short)1234);
    printf("r=%d\n", r);
    return 0;
}
