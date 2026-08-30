#include <stdio.h>
#include <string.h>
/* strlen/strcmp/strcpy, manual reverse, palindrome, char arithmetic, %s widths */
void rev(char *s) {
    int n = (int)strlen(s);
    for (int i = 0, j = n - 1; i < j; i++, j--) { char t = s[i]; s[i] = s[j]; s[j] = t; }
}
int pal(const char *s) {
    int n = (int)strlen(s);
    for (int i = 0; i < n / 2; i++) if (s[i] != s[n - 1 - i]) return 0;
    return 1;
}
int main(void) {
    char buf[32];
    strcpy(buf, "playground");
    printf("%s %d\n", buf, (int)strlen(buf));
    rev(buf);
    printf("%s\n", buf);
    printf("%d %d %d\n", pal("racecar"), pal("arm64"), pal(""));
    printf("%d %d %d\n", strcmp("abc", "abd") < 0, strcmp("abc", "abc"), strcmp("b", "a") > 0);
    char up[32];
    strcpy(up, "Hello, World");
    for (int i = 0; up[i]; i++) if (up[i] >= 'a' && up[i] <= 'z') up[i] = up[i] - 'a' + 'A';
    printf("%s\n", up);
    int vowels = 0;
    for (const char *p = "the quick brown fox"; *p; p++)
        if (*p == 'a' || *p == 'e' || *p == 'i' || *p == 'o' || *p == 'u') vowels++;
    printf("%d\n", vowels);
    printf("[%10s][%-10s][%c%c]\n", "right", "left", 'o', 'k');
    return 0;
}
