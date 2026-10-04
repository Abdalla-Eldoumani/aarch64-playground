/* Tries to break: bit-field reads and writes (ubfx, sbfx, bfi, bfxil) across widths, signedness, 32- and 64-bit straddles, :0 breaks and _Bool, in and out of by-value structs. */
#include <stdio.h>

struct flags {           /* 32 bits in one int container */
    unsigned a : 1;
    unsigned b : 3;
    signed   c : 5;
    unsigned d : 7;
    signed   e : 16;
};

struct wide {            /* y crosses bit 32, so only a 64-bit access reaches it whole */
    unsigned long x : 20;
    unsigned long y : 40;
    unsigned long z : 4;
};

struct split {           /* q cannot cross its 32-bit container, so it starts at bit 32 */
    unsigned p : 20;
    unsigned q : 20;
    unsigned : 0;        /* and r opens a fresh container */
    unsigned r : 3;
    _Bool t : 1;
    signed s1 : 1;       /* holds only 0 and -1 */
};

struct px { unsigned short r : 5, g : 6, b : 5; };  /* one RGB565 pixel in two bytes */

/* gcc documents the bit-field layout, so the raw views below are well defined;
   each raw word is zeroed before any field is written, so no padding bit is unknown. */
union flagsw { struct flags f; unsigned w; };
union widew { struct wide f; unsigned long w; };
union splitw { struct split f; unsigned w[3]; };
union pxw { struct px p; unsigned short h; };

/* The whole struct rides in w0 both ways; each field update is an insert into that word. */
struct flags tick(struct flags f) {
    f.a = !f.a;
    f.b++;                                  /* 7 wraps to 0: unsigned fields are modulo 2^width */
    f.c = f.c - 3 >= -16 ? f.c - 3 : 15;    /* stays inside -16..15 */
    f.d += 45;                              /* modulo 128 */
    f.e = f.e / 2 - 1000;
    return f;
}

/* gcc gives a 40-bit field a 40-bit type of its own, so each read is widened first. */
struct wide widen(struct wide w, unsigned long add) {
    w.y = (unsigned long)w.y + add;
    w.x = (unsigned long)w.x ^ 0xABCDE;
    w.z = (unsigned long)w.z - 1;           /* 0 - 1 wraps to 15 */
    return w;
}

struct px mixpx(struct px a, struct px b) {
    struct px r = { (a.r + b.r) / 2, (a.g * 3 + b.g) / 4, a.b ^ b.b };
    return r;
}

volatile int knob = 30000;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    union flagsw fw;
    fw.w = 0;
    fw.f.a = 1; fw.f.b = 5; fw.f.c = -7; fw.f.d = 100; fw.f.e = (short)knob;
    for (int i = 0; i < 6; i++) {
        printf("flags %d %d %d %d %d raw %08x %s\n", fw.f.a, fw.f.b, fw.f.c, fw.f.d, fw.f.e,
               fw.w, fw.f.c < 0 ? "neg" : "pos");
        fw.f = tick(fw.f);
    }

    union widew ww;
    ww.w = 0;
    ww.f.x = 0x12345; ww.f.y = 0xFFFFFFF000UL; ww.f.z = 0;
    for (int i = 0; i < 3; i++) {
        ww.f = widen(ww.f, 0x2345UL << (i * 8));
        printf("wide %05lx %010lx %lx raw %016lx\n", (unsigned long)ww.f.x,
               (unsigned long)ww.f.y, (unsigned long)ww.f.z, ww.w);
    }

    union splitw sw;
    sw.w[0] = sw.w[1] = sw.w[2] = 0;
    sw.f.p = 0xFFFFF; sw.f.q = 0x12345; sw.f.r = 5; sw.f.t = 2; sw.f.s1 = -1;
    printf("split %x %x %d %d %d raw %08x %08x %08x size %d\n", sw.f.p, sw.f.q, sw.f.r,
           sw.f.t, sw.f.s1, sw.w[0], sw.w[1], sw.w[2], (int)sizeof(struct split));
    sw.f.q += 0xEDCBB;                      /* 0x12345 + 0xEDCBB = 0x100000: wraps to 0 */
    sw.f.p >>= 4;
    sw.f.s1 = 0;
    printf("split %x %x %d raw %08x %08x %08x\n", sw.f.p, sw.f.q, sw.f.s1, sw.w[0], sw.w[1], sw.w[2]);

    union pxw img[16];
    for (int i = 0; i < 16; i++) {
        img[i].h = 0;
        img[i].p.r = (i * 3) & 31;
        img[i].p.g = (i * 5 + 7) & 63;
        img[i].p.b = (31 - i * 2) & 31;
    }
    unsigned sum = 0;
    for (int i = 0; i < 15; i++) {
        img[i].p = mixpx(img[i].p, img[i + 1].p);
        sum = sum * 33 + img[i].h;
    }
    printf("pixels %04x %04x %04x sum %u size %d\n", img[0].h, img[7].h, img[14].h, sum,
           (int)sizeof(struct px));

    int hist[8] = { 0 };
    for (int i = 0; i < 16; i++) hist[img[i].p.g >> 3]++;
    for (int i = 0; i < 8; i++) printf("%d%c", hist[i], i == 7 ? '\n' : ' ');
    printf("sizes %d %d %d\n", (int)sizeof(struct flags), (int)sizeof(struct wide),
           (int)sizeof(union splitw));
    return 0;
}
