/* Tries to break printf %s %c %p %%: raw non-UTF-8 bytes, a precision that cuts a character, NUL via %c, and strings past 64 KiB. */
#include <stdio.h>
#include <string.h>

/* 70000 bytes with no terminator: C lets %.Ns read just N of them. */
static char plain[70000];

static void dump(const char *tag, const char *buf, int len)
{
    printf("%-6s len=%2d:", tag, len);
    for (int i = 0; i < len; i++)
        printf(" %02x", (unsigned char)buf[i]);
    putchar('\n');
}

int main(void)
{
    char buf[64];
    int n;

    n = printf("[%s][%8s][%-8s][%.2s][%8.3s][%-8.0s][%s][%.10s]\n",
               "abc", "abc", "abc", "abc", "abcdef", "abc", "", "short");
    printf("n=%d\n", n);
    /* %c converts its int to unsigned char: 0x179 is 'y', -190 is 'B'. */
    n = printf("[%c][%3c][%-3c][%c%c%c][%*c][%-*c]\n",
               'A', 'B', 'C', 'x', 0x179, -190, 4, 'r', -4, 'l');
    printf("n=%d\n", n);
    n = printf("[%%][%5.1f%%][%%%d%%][%-4s%%]\n", 99.5, 7, "p");
    printf("n=%d\n", n);
    n = printf("[%*s][%-*s][%.*s][%.*s][%*.*s]\n",
               6, "rt", 6, "lt", 2, "cut", -1, "whole", -7, 3, "left");
    printf("n=%d\n", n);

    /* NUL and high bytes through %c land in the buffer byte for byte,
       and the return value counts the NUL. */
    memset(buf, 0x55, sizeof buf);
    n = snprintf(buf, sizeof buf, "a%cb%cc%-3cd%c", 0, 0xff, 0x80, 0xe9);
    dump("chars", buf, n + 2);

    /* Bytes that are not UTF-8 must pass through untouched, and widths
       and precisions count bytes, even in the middle of a character. */
    static const char latin[] = "caf\xe9 \xff\xfe";
    static const char utf8[] = "\xc3\xa9t\xc3\xa9";
    memset(buf, 0x55, sizeof buf);
    n = snprintf(buf, sizeof buf, "[%s][%6s][%.1s][%-4.3s]", latin, utf8, utf8, utf8);
    dump("bytes", buf, n + 1);
    memset(buf, 0x55, sizeof buf);
    n = snprintf(buf, sizeof buf, "\xff%d\xfe%s\x80", 5, "\xc3");
    dump("fmt", buf, n + 1);
    n = printf("%s|%.1s|%10s|%-9s|\n", latin, utf8, latin, utf8);
    printf("n=%d\n", n);

    /* Integer-made pointers only, so no address depends on the loader. */
    n = printf("[%p][%p][%20p][%-20p][%p][%-8p][%8p]\n",
               (void *)0, (void *)0x1234, (void *)0xdeadbeefUL, (void *)0x10,
               (void *)-1L, (void *)0, (void *)0);
    printf("n=%d\n", n);

    /* The rest reads past what the emulator's string reader allows. */
    memset(plain, 'q', sizeof plain);
    plain[9] = 'Z';
    n = printf("[%.5s][%-7.3s][%.*s][%.10s]\n", plain, plain + 69990, 4, plain + 100, plain);
    printf("n=%d\n", n);
    plain[sizeof plain - 1] = '\0';
    n = snprintf(buf, 8, "%s", plain);
    printf("n=%d buf=%s strlen=%zu\n", n, buf, strlen(plain));
    n = printf("%.3s%s\n", plain + 69000, plain + 69990);
    printf("n=%d\n", n);
    return 0;
}
