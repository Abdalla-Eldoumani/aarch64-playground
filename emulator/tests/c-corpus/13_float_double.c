#include <stdio.h>
#include <math.h>
/* double arithmetic, %f precisions, conversions, libm calls, comparisons */
double avg(const double *a, int n) { double s = 0; for (int i = 0; i < n; i++) s += a[i]; return s / n; }
int main(void) {
    double xs[] = {1.5, 2.25, -3.0, 10.125, 0.5};
    printf("%f %.2f %.4f\n", avg(xs, 5), avg(xs, 5), avg(xs, 5));
    double a = 7.0, b = 2.0;
    printf("%f %f %f %f\n", a + b, a - b, a * b, a / b);
    printf("%.3f %.3f %.3f %.3f\n", sqrt(2.0), pow(2.0, 10.0), fabs(-4.5), floor(-2.5));
    printf("%.4f %.4f %.4f\n", sin(1.0), cos(1.0), log(10.0));
    printf("%.6f %.1f\n", fmod(10.5, 3.0), exp(1.0));
    int i = (int)3.99, j = (int)-3.99;
    double d = 7;
    long l = 1234567;
    printf("%d %d %.1f %.1f\n", i, j, d / 2, (double)l / 1000);
    printf("%d %d %d\n", a > b, a == 7.0, b != 2.0);
    double nan = sqrt(-1.0);
    printf("%d %d\n", nan == nan, nan != nan);
    printf("%8.2f|%-8.2f|%08.3f\n", 3.14159, 2.71828, -1.5);
    return 0;
}
