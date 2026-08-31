#include <stdio.h>
/* recursion depth 1000 with a real frame, plus mutual recursion */
int depth(int n, int acc) { int local[4] = {n, acc, n + acc, 0}; if (n == 0) return acc + local[3]; return depth(n - 1, acc + local[0]); }
int is_even(int n);
int is_odd(int n) { return n == 0 ? 0 : is_even(n - 1); }
int is_even(int n) { return n == 0 ? 1 : is_odd(n - 1); }
int main(void) {
    printf("%d\n", depth(1000, 0));
    printf("%d %d\n", is_even(200), is_odd(201));
    return 0;
}
