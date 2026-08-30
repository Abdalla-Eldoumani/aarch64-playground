#include <stdio.h>
/* fopen/fprintf/fclose over the virtual filesystem; only return values are observable */
int main(void) {
    FILE *f = fopen("out.txt", "w");
    if (!f) { printf("open failed\n"); return 1; }
    int n = fprintf(f, "line %d %s %.2f\n", 1, "two", 3.0);
    int r = fclose(f);
    printf("wrote=%d closed=%d\n", n, r);
    FILE *g = fopen("missing.txt", "r");
    printf("missing_is_null=%d\n", g == 0);
    return 0;
}
