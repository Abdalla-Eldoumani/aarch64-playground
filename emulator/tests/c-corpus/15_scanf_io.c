#include <stdio.h>
/* scanf ints, strings, doubles, chars; computed echo */
int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    long sum = 0;
    for (int i = 0; i < n; i++) { int v; scanf("%d", &v); sum += v; }
    printf("n=%d sum=%ld\n", n, sum);
    char word[32];
    scanf("%s", word);
    printf("word=%s\n", word);
    double x, y;
    scanf("%lf %lf", &x, &y);
    printf("%.3f %.3f %.3f\n", x + y, x * y, x / y);
    unsigned int h;
    scanf("%x", &h);
    printf("%u %x\n", h, h);
    char c;
    scanf(" %c", &c);
    printf("c=%c\n", c);
    int extra;
    int r = scanf("%d", &extra);
    printf("eof=%d\n", r == -1 || r == 0);
    return 0;
}
