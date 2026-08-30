#include <stdio.h>
/* short-circuit evaluation with side effects, ternaries, comparison chains */
int calls = 0;
int t(void) { calls++; return 1; }
int f(void) { calls++; return 0; }
int main(void) {
    int a = f() && t();
    int b = t() || f();
    int c = t() && f();
    int d = f() || f();
    printf("%d %d %d %d calls=%d\n", a, b, c, d, calls);
    int x = 5, y = 9;
    int m = x > y ? x : y;
    int n = x < y ? (x == 5 ? 1 : 2) : 3;
    printf("%d %d\n", m, n);
    int cmp = (x < y) + (x <= 5) + (y >= 10) + (x != y) + (x == y);
    printf("%d\n", cmp);
    unsigned int u = 0;
    int sat = (u - 1 > 100) ? 1 : 0;
    printf("%d\n", sat);
    return 0;
}
