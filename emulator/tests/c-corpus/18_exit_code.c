#include <stdio.h>
#include <stdlib.h>
/* exit codes from return and from exit(), including negative and >255 */
int compute(void) { int s = 0; for (int i = 0; i < 10; i++) s += i; return s; }
int main(int argc, char **argv) {
    printf("start\n");
    if (argc > 5) return 1;
    int v = compute();
    printf("v=%d\n", v);
    if (v == 45) exit(-3);
    printf("unreachable\n");
    return 300;
}
