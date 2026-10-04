/* Tries to break the string functions: unsigned byte compares, strncpy padding, overlapping memmove, strtok's saved position, strtol bases and clamping, snprintf truncation counts, and plain char being unsigned. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* A volatile round trip stops plain -O2 from folding the calls on literals. */
static const char *L(const char *s) { const char *volatile p = s; return p; }
static int sgn(int r) { return (r > 0) - (r < 0); }

static void hex(const char *tag, const void *p, int n)
{
    printf("%s", tag);
    for (int i = 0; i < n; i++) printf(" %02x", ((const unsigned char *)p)[i]);
    printf("\n");
}

static void show_cut(const char *tag, const char *b, int n)
{
    printf("%s [", tag);
    for (int i = 0; i < n; i++) putchar(b[i] ? b[i] : '|');
    printf("]\n");
}

int main(void)
{
    char big[300];
    memset(big, 'x', 299);
    big[299] = 0;
    printf("strlen: %d %d %d %d\n", (int)strlen(L("")), (int)strlen(L("a")), (int)strlen(big),
           (int)strlen(L("ab\0cd")));

    printf("cmp: %d %d %d %d %d %d\n", sgn(strcmp(L("abc"), L("abd"))), sgn(strcmp(L("abc"), L("ab"))),
           sgn(strcmp(L(""), L(""))), sgn(strcmp(L("\x80"), L("\x7f"))), sgn(strcmp(L("\xff"), L("\x01"))),
           sgn(strcmp(L("a"), L("a\xe9"))));
    printf("ncmp: %d %d %d %d\n", sgn(strncmp(L("abcX"), L("abcY"), 3)), sgn(strncmp(L("abcX"), L("abcY"), 4)),
           sgn(strncmp(L("x"), L("y"), 0)), sgn(strncmp(L("ab"), L("ab\0zz"), 5)));
    printf("memcmp: %d %d %d\n", sgn(memcmp(L("a\0b"), L("a\0c"), 3)), sgn(memcmp(L("\x90"), L("\x10"), 1)),
           sgn(memcmp(L("same"), L("same"), 4)));

    char d[8];
    memset(d, '#', 8);
    strncpy(d, L("ab"), 6);
    hex("strncpy pad:", d, 8);
    memset(d, '#', 8);
    strncpy(d, L("abcdefgh"), 4);
    hex("strncpy cut:", d, 8);

    char cat[40] = "";
    char *r = strcat(cat, L("one"));
    strcat(strcat(cat, L(",")), L("two"));
    strcat(cat, L(""));
    char *r2 = strcat(cat, L(",three"));
    printf("strcat: [%s] %d %d\n", r2, r == cat, (int)strlen(cat));

    const char *s = L("hello, caf\xe9!");
    printf("strchr: %d %d %d %d %d %d\n", (int)(strchr(s, 'l') - s), (int)(strchr(s, 0) - s),
           strchr(s, 'z') == NULL, (int)(strchr(s, 0x16c) - s), (int)(strchr(s, 0xe9) - s),
           (int)(strchr(s, -23) - s));

    const char *hay = L("abcabcabd"), *a3 = L("aaab");
    printf("strstr: %d %d %d %d %d\n", (int)(strstr(a3, L("aab")) - a3),
           (int)(strstr(hay, L("abcabd")) - hay), strstr(hay, L("")) == hay,
           strstr(L("ab"), L("abc")) == NULL, (int)(strstr(hay, L("cab")) - hay));

    char mv[] = "0123456789";
    memmove(mv + 2, mv, 6);
    printf("memmove up: %s", mv);
    memmove(mv, mv + 3, 5);
    printf(" down: %s", mv);
    memmove(mv + 1, mv + 1, 0);
    memset(mv + 7, 0x141, 2);
    printf(" set: %s\n", mv);

    char tok[] = "  ,,alpha, beta;;gamma ,  ";
    int n = 0;
    printf("strtok:");
    for (char *t = strtok(tok, L(" ,;")); t; t = strtok(NULL, L(" ,;"))) printf(" %d:%s@%d", n++, t, (int)(t - tok));
    printf("\n");
    show_cut("cut", tok, (int)sizeof tok - 1);
    char tok2[] = "a=1&b=22&&c";
    char *k1 = strtok(tok2, L("=")), *v1 = strtok(NULL, L("&")), *k2 = strtok(NULL, L("=")),
         *v2 = strtok(NULL, L("&")), *k3 = strtok(NULL, L("=&")), *end = strtok(NULL, L("&"));
    printf("pairs: %s %s %s %s %s %d\n", k1, v1, k2, v2, k3, end == NULL);

    const char *nums[] = {"  -0x1f", "0777", "z", "12abc", "  +", "0x", "9223372036854775807",
                          "9223372036854775808", "-9223372036854775809", "  42  ", "101102", "Zz", "-0"};
    const int base[] = {0, 0, 36, 10, 10, 16, 10, 10, 10, 10, 2, 36, 0};
    for (int i = 0; i < 13; i++) {
        char *e;
        long v = strtol(L(nums[i]), &e, base[i]);
        printf("strtol[%s,%d] = %ld end %d\n", nums[i], base[i], v, (int)(e - nums[i]));
    }
    printf("atoi: %d %d %d\n", atoi(L("  -123xyz")), atoi(L("")), atoi(L("+0042")));

    char sb[16];
    memset(sb, '*', sizeof sb);
    int w = snprintf(sb, 8, L("%s-%d"), L("abcdef"), 12345);
    printf("snprintf: %d [%s] %c\n", w, sb, sb[8]);
    memset(sb, '*', sizeof sb);
    w = snprintf(sb, 0, L("%d"), 123456);
    printf("size0: %d %c; ", w, sb[0]);
    w = snprintf(sb, 1, L("%s"), L("xyz"));
    printf("size1: %d %d; ", w, sb[0]);
    w = sprintf(sb, L("%x|%5s|%-3d|"), 48879u, L("ab"), 7);
    printf("sprintf: %d [%s]\n", w, sb);

    int cd = 0, ca = 0, cs = 0, cu = 0;
    for (int c = 0; c < 256; c++) {
        cd += !!isdigit(c); ca += !!isalpha(c); cs += !!isspace(c);
        cu += toupper(c) != c;
    }
    printf("ctype: %d %d %d %d %d\n", cd, ca, cs, cu, !!isspace(EOF));
    char up[] = "Hello, World! 123 caf\xe9";
    for (char *p = up; *p; p++) *p = (char)toupper((unsigned char)*p);
    hex("upper:", up + 14, 8);
    printf("%.21s\n", up);

    char c = (char)0xe9;
    printf("plain char: %d %d\n", c, c > 0);
    return 0;
}
