/* Tries to break: structs over 16 bytes returned through x8 and passed as pointers to caller-made copies, through recursion, nesting, tail calls and function pointers. */
#include <stdio.h>

struct v3 { long x, y, z; };                                  /* 24 bytes */
struct m2 { long a, b, c, d; };                               /* 2x2 matrix, 32 bytes */
struct rec { char name[13]; int id; long score; short tag; }; /* 40 bytes with padding */
struct blob { unsigned w[50]; };                              /* 200 bytes */

#define MOD 1000000007L

struct v3 cross(struct v3 a, struct v3 b) {
    struct v3 r = { a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x };
    return r;
}

struct v3 add3(struct v3 a, struct v3 b) {
    struct v3 r = { a.x + b.x, a.y + b.y, a.z + b.z };
    return r;
}

/* Writes into its own copy; the caller's value must not change. */
struct v3 scale(struct v3 a, long k) {
    a.x *= k;
    a.y *= k;
    a.z *= k;
    return a;
}

/* Returns another call's result directly, so -O2 may hand its own x8 straight on. */
struct v3 triple(struct v3 a, struct v3 b) {
    return add3(cross(a, b), scale(a, 2));
}

/* Nine by-value v3 arguments are nine pointers: x0-x7, then the ninth on the stack. */
long nine(struct v3 a, struct v3 b, struct v3 c, struct v3 d, struct v3 e,
          struct v3 f, struct v3 g, struct v3 h, struct v3 i) {
    return a.x + 2 * b.y + 3 * c.z + 4 * d.x + 5 * e.y + 6 * f.z + 7 * g.x + 8 * h.y + 9 * i.z;
}

struct m2 mmul(struct m2 p, struct m2 q) {
    struct m2 r = {
        (p.a * q.a + p.b * q.c) % MOD, (p.a * q.b + p.b * q.d) % MOD,
        (p.c * q.a + p.d * q.c) % MOD, (p.c * q.b + p.d * q.d) % MOD,
    };
    return r;
}

/* Every level must keep its own x8 alive across the recursive call it makes first. */
struct m2 mpow(struct m2 base, unsigned n) {
    if (n == 0) {
        struct m2 one = { 1, 0, 0, 1 };
        return one;
    }
    struct m2 half = mpow(base, n / 2);
    half = mmul(half, half);
    if (n & 1) half = mmul(half, base);
    return half;
}

struct rec mkrec(const char *nm, int id, long score, short tag) {
    struct rec r;
    int i = 0;
    for (; nm[i] && i < 12; i++) r.name[i] = nm[i];
    for (; i < 13; i++) r.name[i] = 0;
    r.id = id;
    r.score = score;
    r.tag = tag;
    return r;
}

struct rec promote(struct rec r, int delta) {
    r.id += delta;
    r.score = r.score * 3 - delta;
    r.tag = (short)-r.tag;
    r.name[0] = (char)(r.name[0] - 32);
    return r;
}

struct blob fill(unsigned seed) {
    struct blob b;
    for (unsigned i = 0; i < 50; i++) b.w[i] = (seed * (i + 1)) ^ (i << 7);
    return b;
}

unsigned long digest(struct blob b) {
    unsigned long h = 1469598103934665603UL;
    for (int i = 0; i < 50; i++) h = (h ^ b.w[i]) * 1099511628211UL;
    return h;
}

struct v3 (*ops[2])(struct v3, struct v3) = { cross, add3 };

volatile long knob = 5;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    long k = knob;
    struct v3 axis = { 1, 2, 3 };
    struct v3 path[6];
    path[0] = (struct v3){ k, -k, 2 * k };
    for (int i = 1; i < 6; i++) path[i] = ops[i & 1](path[i - 1], axis);
    for (int i = 0; i < 6; i++)
        printf("path %d: %ld %ld %ld\n", i, path[i].x, path[i].y, path[i].z);

    struct v3 big = scale(path[5], -3);
    printf("scaled %ld %ld %ld from %ld %ld %ld\n", big.x, big.y, big.z,
           path[5].x, path[5].y, path[5].z);
    struct v3 t = triple(axis, big);
    printf("triple %ld %ld %ld\n", t.x, t.y, t.z);
    printf("nine %ld\n", nine(path[0], path[1], path[2], path[3], path[4], path[5],
                              axis, big, cross(axis, big)));

    struct m2 fib = { 1, 1, 1, 0 };
    unsigned ns[4] = { 10, 50, 90, 1000000 };
    for (int i = 0; i < 4; i++)
        printf("fib(%u) mod p = %ld\n", ns[i], mpow(fib, ns[i]).b);

    struct rec r = mkrec("ada lovelace!", 7, 1815, 12);
    struct rec q = promote(promote(r, 3), 4);
    printf("%s %d %ld %d | %s %d %ld %d | %d\n", r.name, r.id, r.score, r.tag,
           q.name, q.id, q.score, q.tag, (int)sizeof(struct rec));

    struct blob b1 = fill((unsigned)k);
    fill(99);  /* result dropped: x8 still has to point at writable space */
    printf("blob %u %u %016lx\n", b1.w[0], b1.w[49], digest(b1));
    printf("direct %u %016lx\n", fill(7).w[33], digest(fill(8)));
    return 0;
}
