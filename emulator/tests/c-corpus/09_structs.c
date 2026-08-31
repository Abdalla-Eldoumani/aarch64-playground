#include <stdio.h>
/* struct by value and pointer, arrays of structs, small and large struct returns */
struct pt { int x, y; };
struct big { long a, b, c, d; };
struct pt mkpt(int x, int y) { struct pt p = {x, y}; return p; }
struct big mkbig(long s) { struct big b = {s, s * 2, s * 3, s * 4}; return b; }
int dot(struct pt a, struct pt b) { return a.x * b.x + a.y * b.y; }
void scale(struct pt *p, int k) { p->x *= k; p->y *= k; }
struct rec { char tag; short s; int i; long l; };
int main(void) {
    struct pt a = mkpt(3, 4), b = {1, 2};
    scale(&b, 5);
    printf("%d %d %d %d %d\n", a.x, a.y, b.x, b.y, dot(a, b));
    struct big g = mkbig(11);
    printf("%ld %ld %ld %ld\n", g.a, g.b, g.c, g.d);
    struct pt pts[4];
    for (int i = 0; i < 4; i++) { pts[i].x = i; pts[i].y = i * i; }
    int s = 0;
    for (int i = 0; i < 4; i++) s += pts[i].x + pts[i].y;
    printf("%d\n", s);
    struct rec r = {'z', -7, 100000, -1L};
    printf("%c %d %d %ld %d\n", r.tag, r.s, r.i, r.l, (int)sizeof(struct rec));
    return 0;
}
