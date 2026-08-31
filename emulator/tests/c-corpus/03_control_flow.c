#include <stdio.h>
/* if chains, while/do/for, break, continue, goto, nested loops */
int classify(int n) {
    if (n < 0) return -1;
    else if (n == 0) return 0;
    else if (n < 10) return 1;
    else if (n < 100) return 2;
    return 3;
}
int main(void) {
    int vals[] = {-7, 0, 5, 42, 500};
    for (int i = 0; i < 5; i++) printf("%d:%d ", vals[i], classify(vals[i]));
    printf("\n");
    int i = 0, s = 0;
    while (i < 20) { i++; if (i % 3 == 0) continue; if (i > 15) break; s += i; }
    printf("%d %d\n", i, s);
    int k = 10;
    do { k -= 3; } while (k > 0);
    printf("%d\n", k);
    int count = 0;
    for (int r = 0; r < 6; r++)
        for (int c = 0; c < 6; c++)
            if ((r + c) % 2 == 0 && r != c) count++;
    printf("%d\n", count);
    int n = 0;
again:
    n++;
    if (n < 5) goto again;
    printf("%d\n", n);
    int t = (n > 3) ? 100 : 200;
    int logic = (n > 3 && k < 0) || (n == 0);
    printf("%d %d %d\n", t, logic, !logic);
    return 0;
}
