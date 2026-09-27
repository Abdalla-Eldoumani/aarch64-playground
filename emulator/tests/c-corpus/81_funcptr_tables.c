/* Tries to break indirect calls: function pointer tables in .rodata and .data, vtables, a state machine whose states return the next state, stack arguments through a pointer, and indirect tail calls. */
#include <stdio.h>
#include <stdlib.h>

typedef int (*binop)(int, int);

static int add(int a, int b) { return a + b; }   static int sub(int a, int b) { return a - b; }
static int mul(int a, int b) { return a * b; }   static int bxor(int a, int b) { return a ^ b; }
static int band(int a, int b) { return a & b; }  static int bor(int a, int b) { return a | b; }
static int mn(int a, int b) { return a < b ? a : b; }
static int mx(int a, int b) { return a > b ? a : b; }
static int quo(int a, int b) { return b ? a / b : 0; }
static int rem_(int a, int b) { return b ? a % b : 0; }

/* const: lands in .rodata as absolute code and string addresses */
static const struct opdesc { char sym; const char *name; binop fn; } optab[] = {
    {'+', "add", add}, {'-', "sub", sub}, {'*', "mul", mul}, {'/', "quo", quo},
    {'%', "rem", rem_}, {'&', "and", band}, {'|', "or", bor}, {'^', "xor", bxor},
    {'<', "min", mn}, {'>', "max", mx},
};
#define NOPS (int)(sizeof optab / sizeof optab[0])

/* writable: lands in .data and is rotated at run time */
static binop slots[4] = {add, sub, mul, bxor};

static binop pick(char c)
{
    for (int i = 0; i < NOPS; i++)
        if (optab[i].sym == c) return optab[i].fn;
    return NULL;
}

/* Reverse Polish: "3 4 +" is 7. Operators are looked up in the table. */
static int rpn(const char *s, int *ok)
{
    int st[16], sp = 0;
    for (; *s; s++) {
        binop f = pick(*s);
        if (*s >= '0' && *s <= '9' && sp < 16) st[sp++] = *s - '0';
        else if (f && sp >= 2) { sp--; st[sp - 1] = f(st[sp - 1], st[sp]); }
        else if (*s != ' ') break;
    }
    *ok = !*s && sp == 1;
    return sp ? st[sp - 1] : 0;
}

/* At -O2 both become a branch through a register instead of blr. */
static int apply(binop f, int a, int b) { return f(a, b); }
static int repeat(binop f, int acc, int n) { return n ? repeat(f, f(acc, n), n - 1) : acc; }

static long ten(long a, int b, short c, unsigned char d, long e, int f, long g, int h, long i, short j)
{
    return a + 2L * b + 3L * c + 4L * d + 5 * e + 6L * f + 7 * g + 8L * h + 9 * i + 10L * j;
}
/* volatile: the call stays indirect, so the 9th and 10th arguments go on the stack through blr */
static long (*volatile tenp)(long, int, short, unsigned char, long, int, long, int, long, short) = ten;

static long fact(int n);
static long one(int n) { (void)n; return 1; }
static long (*const fact_step[2])(int) = {one, fact};
static long fact(int n) { return n * fact_step[n > 1](n - 1); }

struct shape;
struct shape_vt {
    const char *kind;
    long (*area2)(const struct shape *);
    long (*perim)(const struct shape *);
    void (*grow)(struct shape *, int);
};
struct shape { const struct shape_vt *vt; int a, b, c; };
static long rect_area2(const struct shape *s) { return 2L * s->a * s->b; }
static long rect_perim(const struct shape *s) { return 2L * (s->a + s->b); }
static void rect_grow(struct shape *s, int k) { s->a += k; s->b += k; }
static long tri_area2(const struct shape *s) { return (long)s->a * s->b; }
static long tri_perim(const struct shape *s) { return (long)s->a + s->b + s->c; }
static void tri_grow(struct shape *s, int k) { s->a *= k; s->b *= k; s->c *= k; }
static const struct shape_vt rect_vt = {"rect", rect_area2, rect_perim, rect_grow};
static const struct shape_vt tri_vt = {"tri", tri_area2, tri_perim, tri_grow};
static const struct shape_vt square_vt = {"square", rect_area2, rect_perim, rect_grow};

/* Each state returns the next one, wrapped in a struct because a function
   cannot name its own type. Accepts [+-]digits with single '_' between digits. */
struct st { struct st (*fn)(int c, long *acc); };
static struct st st_err(int c, long *acc) { (void)c; (void)acc; struct st r = {st_err}; return r; }
static struct st st_digit(int c, long *acc);
static struct st st_need(int c, long *acc)
{
    struct st r = {st_err};
    if (c >= '0' && c <= '9') { acc[0] = acc[0] * 10 + (c - '0'); r.fn = st_digit; }
    return r;
}
static struct st st_digit(int c, long *acc)
{
    struct st r = {NULL};
    if (c == '_') r.fn = st_need;
    else if (c) r = st_need(c, acc);
    return r;
}
static struct st st_start(int c, long *acc)
{
    struct st r = {st_need};
    if (c == '-') acc[1] = -1;
    else if (c != '+') r = st_need(c, acc);
    return r;
}

static int parse(const char *s, long *out)
{
    long acc[2] = {0, 1};
    struct st cur = {st_start};
    for (; cur.fn && cur.fn != st_err; s++) {
        cur = cur.fn((unsigned char)*s, acc);
        if (!*s) break;
    }
    *out = acc[0] * acc[1];
    return cur.fn == NULL;
}

int main(void)
{
    int i, ok, r;
    const char *ex[] = {"3 4 + 2 *", "9 7 % 5 ^", "8 5 < 9 >", "1 2 3 4 + + +", "5 0 /",
                        "2 +", "9 6 & 6 |", "7 3 - 4 - 1 2 * *", "9 x", "9 9 * 9 * 9 * 9 -"};
    for (i = 0; i < 10; i++) {
        r = rpn(ex[i], &ok);
        printf("rpn [%s] = %d%s\n", ex[i], r, ok ? "" : " (bad)");
    }
    for (i = 0; i < NOPS; i++)
        printf("%s%s(-17,5)=%d", i ? " " : "ops: ", optab[i].name, apply(optab[i].fn, -17, 5));
    printf("\nsame: %d %d %d %d\n", pick('+') == add, pick('?') == NULL, optab[3].fn == quo,
           pick('<') == pick('>'));

    for (int round = 0; round < 4; round++) {
        int acc = 1000;
        for (i = 0; i < 4; i++) acc = slots[i](acc, 7 + round);
        binop t = slots[0];
        slots[0] = slots[1]; slots[1] = slots[2]; slots[2] = slots[3]; slots[3] = t;
        printf("round %d: %d repeat=%d\n", round, acc, repeat(slots[round], 1, 6));
    }

    printf("ten: %ld\n", tenp(-1, -2, -3, 200, 1L << 40, -6, -7, 8, -(1L << 35), -10));
    printf("fact:");
    for (i = 1; i <= 20; i += 3) printf(" %ld", fact(i));
    printf(" %ld\n", fact(20));

    struct shape *sh = malloc(4 * sizeof *sh);
    const struct shape_vt *vts[4] = {&rect_vt, &tri_vt, &square_vt, &tri_vt};
    for (i = 0; i < 4; i++) {
        sh[i].vt = vts[i];
        sh[i].a = 3 + i; sh[i].b = i == 2 ? 3 + i : 4 + 2 * i; sh[i].c = 5 + 3 * i;
    }
    for (int pass = 0; pass < 2; pass++)
        for (i = 0; i < 4; i++) {
            printf("%s area2=%ld perim=%ld\n", sh[i].vt->kind, sh[i].vt->area2(&sh[i]),
                   sh[i].vt->perim(&sh[i]));
            sh[i].vt->grow(&sh[i], 2);
        }
    free(sh);

    const char *nums[] = {"-12_345", "+7", "1__2", "-", "12a", "0", "_5", "9_", "", "-0_0_1"};
    for (i = 0; i < 10; i++) {
        long v;
        ok = parse(nums[i], &v);
        printf("parse [%s] %s %ld\n", nums[i], ok ? "ok" : "no", ok ? v : 0L);
    }
    return 0;
}
