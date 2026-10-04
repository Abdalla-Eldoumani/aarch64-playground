/* Tries to break va_arg on aggregates: small structs in x registers, a 16-byte struct that cannot split, big structs by reference, HFAs in v registers, and an sret return. */
#include <stdio.h>
#include <stdarg.h>

struct pair { int a, b; };               /* 8 bytes: one x register */
struct trio { short a; int b; char c; }; /* 12 bytes: two x registers */
struct wide { long a, b; };              /* 16 bytes: two x registers or the stack */
struct big { long a, b, c; };            /* 24 bytes: passed as a pointer to a copy */
struct hfa3 { double x, y, z; };         /* three v registers, or the stack */
struct hfa4 { float a, b, c, d; };       /* four v registers, or the stack */
struct mixed { double d; long l; };      /* not an HFA: two x registers */

/* Each tag letter names the type of the next argument. The result comes
   back through x8, which va_start must not disturb. */
static struct big walk(const char *tags, ...)
{
    struct big acc = { 0, 0, 0 };
    va_list ap;
    va_start(ap, tags);
    printf("%-10s", tags);
    for (const char *t = tags; *t; t++) {
        switch (*t) {
        case 'i': {
            int v = va_arg(ap, int);
            printf(" i:%d", v);
            acc.a += v;
            break;
        }
        case 'd': {
            double v = va_arg(ap, double);
            printf(" d:%g", v);
            acc.c += (long)(v * 8);
            break;
        }
        case 'p': {
            struct pair v = va_arg(ap, struct pair);
            printf(" p:%d,%d", v.a, v.b);
            acc.a += v.a * v.b;
            break;
        }
        case 't': {
            struct trio v = va_arg(ap, struct trio);
            printf(" t:%hd,%d,%c", v.a, v.b, v.c);
            acc.b += v.a + v.b + v.c;
            break;
        }
        case 'w': {
            struct wide v = va_arg(ap, struct wide);
            printf(" w:%lx,%ld", v.a, v.b);
            acc.b ^= v.a + v.b;
            break;
        }
        case 'b': {
            struct big v = va_arg(ap, struct big);
            printf(" b:%ld,%ld,%ld", v.a, v.b, v.c);
            acc.c += v.a * 100 + v.b * 10 + v.c;
            break;
        }
        case 'h': {
            struct hfa3 v = va_arg(ap, struct hfa3);
            printf(" h:%g,%g,%g", v.x, v.y, v.z);
            acc.c += (long)(v.x * 1000 + v.y * 100 + v.z * 10);
            break;
        }
        case 'f': {
            struct hfa4 v = va_arg(ap, struct hfa4);
            printf(" f:%g,%g,%g,%g", v.a, v.b, v.c, v.d);
            acc.c += (long)(v.a * 8 + v.b * 4 + v.c * 2 + v.d);
            break;
        }
        case 'm': {
            struct mixed v = va_arg(ap, struct mixed);
            printf(" m:%g,%ld", v.d, v.l);
            acc.b += (long)v.d * v.l;
            break;
        }
        }
    }
    va_end(ap);
    putchar('\n');
    return acc;
}

static void report(struct big r)
{
    printf("  -> %ld %ld %ld\n", r.a, r.b, r.c);
}

int main(void)
{
    struct pair p = { 3, -4 };
    struct trio t = { -7, 70000, 'z' };
    struct wide w = { 0x1111111111111111L, -2 };
    struct big b = { 1, -20, 300 }, b2 = { -4, 5, -6 };
    struct hfa3 h = { 1.5, -2.0, 0.25 }, h2 = { 8.0, 0.5, -0.125 };
    struct hfa4 f = { 1.0f, 2.5f, -3.0f, 0.125f };
    struct mixed m = { 6.5, -99 };

    report(walk("pt", p, t));
    /* Six ints leave only x7: the struct goes to the stack whole and the
       int after it follows it there. */
    report(walk("iiiiiiwi", 1, 2, 3, 4, 5, 6, w, 8));
    /* Five ints leave x6 and x7: the struct fits exactly. */
    report(walk("iiiiiwi", 1, 2, 3, 4, 5, w, 7));
    report(walk("bbbbbbbbi", b, b2, b, b2, b, b2, b, b2, 9));
    /* h takes v0-v2 and f v3-v6; the second h needs three and finds one. */
    report(walk("hfhd", h, f, h2, 4.5));
    report(walk("fdfdd", f, 0.75, f, -1.25, 2.0));
    report(walk("dddddddhd", 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, h, 9.5));
    report(walk("mdmi", m, 2.0, m, 5));
    report(walk("iiiiiimi", 1, 2, 3, 4, 5, 6, m, 8));
    report(walk("pptwpbhmfi", p, p, t, w, p, b, h, m, f, 42));
    return 0;
}
