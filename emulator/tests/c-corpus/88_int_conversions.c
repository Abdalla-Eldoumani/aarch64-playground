/* Tries to break sign and zero extension: every narrowing and widening between char, short, int and long, done at run time. */
#include <stdio.h>
#include <limits.h>

/* Values are read through volatile so each conversion is a real
   instruction (sxtb, uxth, sxtw, ldrsb, ...) at every optimisation level.
   Narrowing to a signed type is implementation-defined; gcc wraps. */
static volatile long inputs[] = {
    0, 1, -1, 127, 128, 255, 256, -128, -129, 32767, 32768, 65535, 65536,
    INT_MAX, (long)INT_MAX + 1, INT_MIN, (long)INT_MIN - 1, UINT_MAX,
    (long)UINT_MAX + 1, LONG_MAX, LONG_MIN, 0x123456789abcdef0L,
};

/* Arguments narrower than a register: the callee extends what it gets. */
static long widen_sc(signed char c) { return c; }
static long widen_uc(unsigned char c) { return c; }
static long widen_ss(short s) { return s; }
static long widen_us(unsigned short s) { return s; }
static unsigned long widen_int_to_ul(int i) { return i; }
static long widen_uint_to_l(unsigned u) { return u; }
static signed char narrow_ret(int i) { return (signed char)i; }

static volatile signed char sb[] = {-128, -1, 0, 1, 127};
static volatile unsigned char ub[] = {0, 1, 127, 128, 255};
static volatile short sh[] = {-32768, -1, 0, 1, 32767};
static volatile unsigned short uh[] = {0, 1, 32767, 32768, 65535};
static volatile int si[] = {INT_MIN, -1, 0, 1, INT_MAX};

int main(void)
{
    int n = sizeof inputs / sizeof inputs[0];
    printf("plain char is %s, CHAR_MIN %d CHAR_MAX %d\n",
           (char)-1 < 0 ? "signed" : "unsigned", CHAR_MIN, CHAR_MAX);

    for (int i = 0; i < n; i++) {
        long v = inputs[i];
        printf("%ld: sc %d uc %d c %d ss %d us %d i %d u %u\n", v,
               (signed char)v, (unsigned char)v, (char)v, (short)v,
               (unsigned short)v, (int)v, (unsigned)v);
        printf("  sext %016lx zext %016lx args %ld %ld %ld %ld %lx %ld ret %d\n",
               (unsigned long)(int)v, (unsigned long)(unsigned)v,
               widen_sc((signed char)v), widen_uc((unsigned char)v),
               widen_ss((short)v), widen_us((unsigned short)v),
               widen_int_to_ul((int)v), widen_uint_to_l((unsigned)v),
               narrow_ret((int)v));
    }

    /* Loads of every width into one long sum (ldrsb, ldrb, ldrsh, ldrh, ldrsw). */
    long s = 0;
    for (int i = 0; i < 5; i++)
        s = s * 7 + sb[i] + ub[i] + sh[i] + uh[i] + si[i];
    printf("width sum %ld\n", s);

    /* The usual arithmetic conversions pick signed or unsigned compares. */
    volatile int m1 = -1, one = 1;
    volatile unsigned u0 = 0, u1 = 1;
    volatile long lm1 = -1;
    volatile unsigned long ul1 = 1;
    printf("cmp %d %d %d %d %d %d\n",
           m1 < u0, (long)m1 < (long)u0, lm1 < u1, m1 < one, lm1 < ul1,
           (unsigned char)m1 > one);

    /* Mixed-width arithmetic: the narrower operand converts first. */
    printf("mix %ld %lu %u %d %ld\n",
           u1 + lm1 - 1,          /* unsigned int + long: long */
           ul1 + m1 - 1,          /* unsigned long + int: unsigned long, wraps */
           u0 - u1,               /* unsigned wraps to UINT_MAX */
           (int)(u0 - u1),        /* and back to int */
           (long)(u0 - u1));      /* zero extended, not sign extended */

    /* Small unsigned types promote to signed int before arithmetic. */
    volatile unsigned char x = 200, y = 100;
    volatile unsigned short p = 65535, q = 65535;
    printf("promote %d %d %d %u %u\n", x + y, (unsigned char)(x + y), y - x,
           (unsigned)p * q, (unsigned)(unsigned short)(p + q));

    /* Round trips that must come back unchanged, or must not. */
    int bad = 0;
    for (int i = 0; i < n; i++) {
        long v = inputs[i];
        bad += (long)(int)v != v;
        bad += (long)(unsigned)v != v;
        bad += (long)(short)v != v;
        bad += (long)(unsigned long)v != v;
    }
    printf("lossy round trips %d\n", bad);
    return 0;
}
