/* Tries to break: a recursive descent parser 3000 frames deep, with overflow checks that live on the V flag and the smulh high half. */
#include <stdio.h>
#include <string.h>
#include <limits.h>

/* cond := sum ['?' cond ':' cond]   sum := product {(+|-) product}
   product := unary {(*|/|%) unary}  unary := '-' unary | atom ['^' unary]
   atom := number | '(' cond ')'
   One frame per rule, so each parenthesis nests five more frames. */
static const char *pos, *start, *fail;
static int where, depth, max_depth;
static char buf[16384];

static long long cond(void);

static long long oops(const char *msg)
{
    if (!fail) {
        fail = msg;
        where = (int)(pos - start);
    }
    return 0;
}

static void skip(void) { while (*pos == ' ') pos++; }

static long long atom(void)
{
    long long v = 0;

    skip();
    if (*pos == '(') {
        pos++;
        v = cond();
        skip();
        if (fail)
            return 0;
        if (*pos != ')')
            return oops("expected ')'");
        pos++;
        return v;
    }
    if (*pos < '0' || *pos > '9')
        return oops("expected a number");
    while (*pos >= '0' && *pos <= '9') {
        int d = *pos++ - '0';
        if (v > (LLONG_MAX - d) / 10)
            return oops("number too big");
        v = v * 10 + d;
    }
    return v;
}

/* square and multiply: if a squaring overflows, the answer would too */
static long long ipow(long long b, long long e)
{
    long long r = 1;

    if (e < 0)
        return oops("negative exponent");
    for (; e > 0; e >>= 1) {
        if ((e & 1) && __builtin_mul_overflow(r, b, &r))
            return oops("overflow");
        if (e > 1 && __builtin_mul_overflow(b, b, &b))
            return oops("overflow");
    }
    return r;
}

/* minus binds looser than '^', so -2^2 is -4; '^' is right associative */
static long long unary(void)
{
    long long v, r;

    skip();
    if (*pos == '-') {
        pos++;
        v = unary();
        return __builtin_sub_overflow(0, v, &r) ? oops("overflow") : r;
    }
    v = atom();
    skip();
    if (fail || *pos != '^')
        return v;
    pos++;
    r = unary();
    return fail ? 0 : ipow(v, r);
}

static long long product(void)
{
    long long v = unary(), w;
    char op;

    for (skip(); !fail && (*pos == '*' || *pos == '/' || *pos == '%'); skip()) {
        op = *pos++;
        w = unary();
        if (fail)
            return 0;
        if (op == '*' && __builtin_mul_overflow(v, w, &v))
            return oops("overflow");
        if (op != '*' && w == 0)
            return oops("divide by zero");
        if (op != '*' && v == LLONG_MIN && w == -1)
            return oops("overflow");
        if (op != '*')
            v = op == '/' ? v / w : v % w;
    }
    return v;
}

static long long sum(void)
{
    long long v = product(), w;
    char op;

    for (skip(); !fail && (*pos == '+' || *pos == '-'); skip()) {
        op = *pos++;
        w = product();
        if (op == '+' ? __builtin_add_overflow(v, w, &v) : __builtin_sub_overflow(v, w, &v))
            return oops("overflow");
    }
    return v;
}

static long long cond(void)
{
    long long c, a, b;

    if (++depth > max_depth)
        max_depth = depth;
    c = sum();
    skip();
    if (!fail && *pos == '?') {
        pos++;
        a = cond();
        skip();
        if (!fail && *pos != ':') {
            oops("expected ':'");
        } else if (!fail) {
            pos++;
            b = cond();
            c = c ? a : b;
        }
    }
    depth--;
    return c;
}

static void run(const char *label, const char *text)
{
    long long v;

    start = pos = text;
    fail = 0;
    depth = max_depth = 0;
    v = cond();
    skip();
    if (!fail && *pos)
        oops("unexpected character");
    if (fail)
        printf("%-26.26s -> error at %d: %s\n", label, where, fail);
    else
        printf("%-26.26s -> %lld (depth %d)\n", label, v, max_depth);
}

static const char *const cases[] = {
    "1+2*3", "(1+2)*3", "100-10-1", "2^3^2", "-2^2", "(-2)^3", "-7/2", "-7%3", "7%-3",
    "-(-(-5))", "2*(3+4)*(5-(6-7))", " 12 * ( 3 + 4 ) ", "2-2?10:20", "0?1:1?7:8",
    "9223372036854775807+0", "-9223372036854775807-1", "-9223372036854775807-2",
    "9223372036854775808", "3037000499*3037000499", "3037000500*3037000500",
    "-3037000500*3037000500", "2^62", "2^63", "(-2)^63", "(0-9223372036854775807-1)/-1",
    "(0-9223372036854775807-1)%-1", "4/0", "1+", "(1+2", "2^-1", "1 2", "1?2", "",
};

int main(void)
{
    int i;
    char *p;

    for (i = 0; i < (int)(sizeof cases / sizeof cases[0]); i++)
        run(cases[i], cases[i]);
    memset(buf, '(', 600);
    buf[600] = '7';
    memset(buf + 601, ')', 600);
    buf[1201] = 0;
    run("600 parens", buf);
    buf[1200] = 0;
    run("600 parens, one short", buf);
    for (p = buf, i = 0; i < 201; i++, p += 2)
        memcpy(p, "-(", 2);
    *p++ = '5';
    memset(p, ')', 201);
    p[201] = 0;
    run("201 minus levels", buf);
    for (p = buf, i = 1; i <= 300; i++)
        p += sprintf(p, i == 1 ? "%d" : "+%d", i);
    run("sum 1..300", buf);
    /* 2^1^...^1 with 400 carets: right associative, so it recurses */
    for (p = buf, i = 0; i < 400; i++)
        p += sprintf(p, "%s", i ? "^1" : "2^1");
    run("400 carets", buf);
    return 0;
}
