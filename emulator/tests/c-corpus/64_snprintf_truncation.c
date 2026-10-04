/* Tries to break sprintf, snprintf, and fprintf: the untruncated return value, the terminator at every size, bytes left untouched past it, and offset chaining. */
#include <stdio.h>
#include <string.h>

/* Print a buffer with every byte visible, so a stray NUL, a missing
   terminator, or an overwritten guard byte shows up in stdout. */
static void show(const char *buf, int len)
{
    putchar('"');
    for (int i = 0; i < len; i++) {
        unsigned char c = (unsigned char)buf[i];
        if (c >= 32 && c < 127 && c != '\\')
            putchar(c);
        else
            printf("\\x%02x", c);
    }
    puts("\"");
}

int main(void)
{
    char buf[48];
    char line[256];
    int n;

    /* The full text is "42   |-3.14|tail|0x1f" (21 bytes). */
    for (size_t size = 0; size <= 23; size++) {
        memset(buf, '#', sizeof buf);
        n = snprintf(size ? buf : NULL, size, "%-5d|%+.2f|%s|%#x", 42, -3.14159, "tail", 31u);
        printf("size=%2zu n=%d ", size, n);
        show(buf, 24);
    }

    /* Wide conversions truncated in the middle of their padding. The
       volatile keeps gcc from warning about a truncation made on purpose. */
    for (volatile size_t size = 1; size <= 13; size += 3) {
        memset(buf, '#', sizeof buf);
        n = snprintf(buf, size, "%10.3e|%-8s|", 1234.5678, "pad");
        printf("size=%2zu n=%d ", size, n);
        show(buf, 16);
    }

    /* sprintf returns the count written, NUL from %c included, so the
       count and strlen part ways here. */
    memset(buf, '#', sizeof buf);
    n = sprintf(buf, "ab%ccd%s", 0, "ef");
    printf("n=%d strlen=%zu ", n, strlen(buf));
    show(buf, n + 2);

    /* Chaining through the returned counts builds one line in place. */
    int pos = 0;
    for (int i = 0; i < 8; i++)
        pos += sprintf(line + pos, "%s%03d:%x:%-3c", i ? "," : "", i * 37 - 100, i * 255u, 'a' + i);
    printf("pos=%d strlen=%zu [%s]\n", pos, strlen(line), line);

    /* snprintf into the tail of the same buffer, never past its end. */
    pos = 0;
    for (int i = 0; i < 12; i++) {
        int want = snprintf(buf + pos, sizeof buf - pos, "<%d:%.1f>", i, i * 0.5);
        printf("i=%d want=%d pos=%d\n", i, want, pos);
        if (want >= (int)(sizeof buf - pos)) {
            pos = (int)sizeof buf - 1;
            break;
        }
        pos += want;
    }
    printf("final pos=%d strlen=%zu [%s]\n", pos, strlen(buf), buf);

    /* fprintf moves its varargs one register over (x0 is the stream). */
    n = fprintf(stdout, "fp:%d,%ld,%s,%c,%5.2f,%x,%u,%d,%d,%d|", -1, 1L << 40, "s", 'c', 2.25,
                0xabcu, 7u, 8, 9, 10);
    int m = putchar('!');
    printf(" n=%d m=%d\n", n, m);

    /* The stored text must match what printf itself prints. */
    n = snprintf(line, sizeof line, "%08.3f|%-6d|%+i|%5s|%%|%o", -2.5, -17, 3, "ok", 8u);
    int p = printf("%s\n", line);
    printf("n=%d p=%d same=%d\n", n, p, p == n + 1);
    return 0;
}
