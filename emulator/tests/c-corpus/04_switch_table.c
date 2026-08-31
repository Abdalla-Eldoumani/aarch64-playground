#include <stdio.h>
/* dense switch (compiler jump table), sparse switch, fallthrough, default */
const char *dense(int op) {
    switch (op) {
        case 0: return "zero";
        case 1: return "one";
        case 2: return "two";
        case 3: return "three";
        case 4: return "four";
        case 5: return "five";
        case 6: return "six";
        case 7: return "seven";
        default: return "many";
    }
}
int sparse(int op) {
    switch (op) {
        case 1: return 10;
        case 100: return 20;
        case 1000: return 30;
        case 5000: return 40;
        default: return -1;
    }
}
int fall(int c) {
    int r = 0;
    switch (c) {
        case 'a': r += 1;
        case 'b': r += 10;
        case 'c': r += 100; break;
        case 'd': r = 7; break;
        default: r = -1;
    }
    return r;
}
int main(void) {
    for (int i = -1; i <= 8; i++) printf("%s ", dense(i));
    printf("\n");
    int q[] = {1, 100, 1000, 5000, 3};
    for (int i = 0; i < 5; i++) printf("%d ", sparse(q[i]));
    printf("\n");
    printf("%d %d %d %d %d\n", fall('a'), fall('b'), fall('c'), fall('d'), fall('z'));
    return 0;
}
