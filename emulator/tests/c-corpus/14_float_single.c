#include <stdio.h>
/* single precision: f32 arithmetic, rounding, fcvt both ways */
float fsum(const float *a, int n) { float s = 0.0f; for (int i = 0; i < n; i++) s += a[i]; return s; }
int main(void) {
    float xs[] = {0.1f, 0.2f, 0.3f, 1e6f, 1e-6f};
    float s = fsum(xs, 5);
    printf("%f %.8f\n", s, (double)s);
    float a = 1.0f / 3.0f;
    double d = a;
    printf("%.10f %.10f\n", (double)a, d);
    float big = 16777216.0f;
    printf("%.1f %.1f\n", (double)(big + 1.0f), (double)(big + 2.0f));
    int i = (int)(2.5f * 3.0f);
    float fromint = 12345678;
    printf("%d %.1f\n", i, (double)fromint);
    float x = 5.5f, y = 2.0f;
    printf("%.2f %.2f %.2f %.2f %d\n", (double)(x + y), (double)(x - y), (double)(x * y), (double)(x / y), x > y);
    return 0;
}
