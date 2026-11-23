// art_: palettes, the priority table for scaling down, and every sprite as text.
// A sprite row is one character per pixel: '.' is transparent and the sprite's legend maps
// each other character to a colour slot. Glyphs keep all their rows on one line, split by '/'.

ART_PAL_BYTES = SLOT_COUNT * 4
ART_NIGHT_BYTES = SLOT_PDARK * 4
ART_BIRD_OFF = SLOT_BODY * 4
ART_BIRD_BYTES = (SLOT_WING - SLOT_BODY + 1) * 4
ART_MEDAL_OFF = SLOT_MED1 * 4
ART_MEDAL_BYTES = (SLOT_MED3 - SLOT_MED1 + 1) * 4
ART_LETTERS = 26
ART_LETTER_LAST = ART_LETTERS - 1
ART_SYMBOL0 = ART_DIGIT0 + ART_DIGIT_LAST + 1
ART_PAL_SPARE = (SLOT_COUNT - SLOT_MED3 - 1) * 4
// one legend entry per 7-bit character code
ART_MAP_BYTES = 128
ART_CODE_MASK = ART_MAP_BYTES - 1
// decoding costs about this many instructions a pixel, counted toward the next sleep
ART_COST_DECODE = 10
// a byte times this is that byte in all eight lanes of a word
ART_BYTES8 = 0x0101010101010101

        .section .rodata
// day palette: slot -> R, G, B, pad
        .balign 4
art_day:
        .byte   18, 20, 28, 0
        .byte   112, 197, 206, 0
        .byte   134, 208, 214, 0
        .byte   236, 248, 242, 0
        .byte   212, 238, 232, 0
        .byte   178, 222, 206, 0
        .byte   156, 208, 192, 0
        .byte   206, 238, 222, 0
        .byte   104, 192, 98, 0
        .byte   82, 166, 84, 0
        .byte   64, 72, 40, 0
        .byte   150, 222, 84, 0
        .byte   118, 200, 64, 0
        .byte   86, 156, 48, 0
        .byte   222, 212, 150, 0
        .byte   200, 186, 124, 0
        .byte   40, 56, 30, 0
        .byte   176, 234, 104, 0
        .byte   118, 196, 52, 0
        .byte   78, 148, 36, 0
        .byte   44, 30, 36, 0
        .byte   250, 204, 46, 0
        .byte   226, 150, 34, 0
        .byte   255, 236, 168, 0
        .byte   255, 248, 222, 0
        .byte   255, 255, 255, 0
        .byte   34, 26, 30, 0
        .byte   242, 104, 44, 0
        .byte   196, 64, 36, 0
        .byte   255, 255, 255, 0
        .byte   40, 30, 34, 0
        .byte   238, 228, 170, 0
        .byte   122, 88, 56, 0
        .byte   226, 98, 58, 0
        .byte   252, 168, 48, 0
        .byte   222, 50, 44, 0
        .byte   240, 182, 120, 0
        .byte   200, 124, 66, 0
        .byte   132, 78, 40, 0
        .skip   ART_PAL_SPARE
// night replaces the scenery slots, 1 to 19; the bird and text keep the day colours
art_night:
        .byte   22, 40, 78, 0
        .byte   30, 54, 96, 0
        .byte   60, 84, 124, 0
        .byte   48, 70, 110, 0
        .byte   40, 62, 100, 0
        .byte   32, 50, 86, 0
        .byte   236, 206, 110, 0
        .byte   34, 96, 76, 0
        .byte   26, 76, 62, 0
        .byte   30, 36, 24, 0
        .byte   92, 160, 70, 0
        .byte   70, 136, 56, 0
        .byte   50, 104, 40, 0
        .byte   150, 142, 104, 0
        .byte   128, 118, 86, 0
        .byte   20, 32, 20, 0
        .byte   130, 196, 80, 0
        .byte   84, 156, 40, 0
        .byte   56, 112, 28, 0
// bird colours: body, shade, belly, wing for each of the three birds
art_birds:
        .byte   250, 204, 46, 0, 226, 150, 34, 0, 255, 236, 168, 0, 255, 248, 222, 0
        .byte   242, 110, 82, 0, 204, 74, 58, 0, 255, 214, 190, 0, 255, 240, 230, 0
        .byte   164, 124, 236, 0, 122, 88, 196, 0, 226, 212, 255, 0, 246, 240, 255, 0
// medal colours, light, mid and dark: bronze, silver, gold, platinum
art_medals:
        .byte   240, 182, 120, 0, 200, 124, 66, 0, 132, 78, 40, 0
        .byte   246, 246, 250, 0, 196, 202, 214, 0, 128, 134, 150, 0
        .byte   255, 236, 128, 0, 242, 186, 40, 0, 178, 122, 18, 0
        .byte   236, 252, 255, 0, 170, 224, 240, 0, 98, 156, 186, 0

// the bird at scale 1: three wing frames of 17 x 12
        .balign 4
        .global art_bird1
art_bird1:
        .ascii  ".....000000......"
        .ascii  "...0011110000...."
        .ascii  "000000110555500.."
        .ascii  "044440110556650.."
        .ascii  "044440110556650.."
        .ascii  "000000111000000.."
        .ascii  ".0111111110777770"
        .ascii  ".011111111088880."
        .ascii  ".02223333300000.."
        .ascii  "..022233333330..."
        .ascii  "...0223333330...."
        .ascii  ".....000000......"
        .ascii  ".....000000......"
        .ascii  "...0011110000...."
        .ascii  "..011111055550..."
        .ascii  ".01111110556650.."
        .ascii  "000000110556650.."
        .ascii  "044440111000000.."
        .ascii  "04444011110777770"
        .ascii  "0000001111088880."
        .ascii  ".02223333300000.."
        .ascii  "..022233333330..."
        .ascii  "...0223333330...."
        .ascii  ".....000000......"
        .ascii  ".....000000......"
        .ascii  "...0011110000...."
        .ascii  "..011111055550..."
        .ascii  ".01111110556650.."
        .ascii  ".01111110556650.."
        .ascii  ".01111111000000.."
        .ascii  "00000011110777770"
        .ascii  "0444401111088880."
        .ascii  "044440333300000.."
        .ascii  "00000033333330..."
        .ascii  "...0223333330...."
        .ascii  ".....000000......"
// scale 2, drawn at that size: 9 x 6
        .balign 4
        .global art_bird2
art_bird2:
        .ascii  "..00000.."
        .ascii  "04411560."
        .ascii  "04411550."
        .ascii  "011111770"
        .ascii  ".0233380."
        .ascii  "..00000.."
        .ascii  "..00000.."
        .ascii  ".0111560."
        .ascii  "01111550."
        .ascii  "044411770"
        .ascii  ".0233380."
        .ascii  "..00000.."
        .ascii  "..00000.."
        .ascii  ".0111560."
        .ascii  ".0111550."
        .ascii  "044411770"
        .ascii  "04423380."
        .ascii  "..00000.."
// scale 3: 6 x 4
        .balign 4
        .global art_bird3
art_bird3:
        .ascii  ".4000."
        .ascii  "041156"
        .ascii  "011177"
        .ascii  ".0000."
        .ascii  ".0000."
        .ascii  "041156"
        .ascii  "041177"
        .ascii  ".0000."
        .ascii  ".0000."
        .ascii  "011156"
        .ascii  "041177"
        .ascii  ".4000."
// scale 4: 5 x 3
        .balign 4
        .global art_bird4
art_bird4:
        .ascii  "2156."
        .ascii  "21177"
        .ascii  ".022."
        .ascii  "1156."
        .ascii  "22177"
        .ascii  ".022."
        .ascii  "1156."
        .ascii  "11177"
        .ascii  "2222."
// pipe cap, 26 x 12, the same art above and below the gap
        .balign 4
        .global art_cap
art_cap:
        .ascii  "00000000000000000000000000"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "01111222222222222233333330"
        .ascii  "00000000000000000000000000"
// pipe body, one 24-pixel row repeated
        .balign 4
        .global art_pbody
art_pbody:
        .ascii  "011122222222222223333330"
// cloud bank tile, 48 x 12
        .balign 4
        .global art_cloud
art_cloud:
        .ascii  "................................................"
        .ascii  ".............11...........................11...."
        .ascii  "..........111111.......................111111..."
        .ascii  "....11...11111111..........111......11111111111."
        .ascii  "..11111111111111111......1111111..1111111111111."
        .ascii  ".1111111111111111111...111111111111111111111111."
        .ascii  "111111111111111111111111111111111111111111111111"
        .ascii  "111111111111111111111111111111111111111111111111"
        .ascii  "211111111111111112221111111111111111222111111112"
        .ascii  "222211111111112222222211111111111222222221112222"
        .ascii  "222222222222222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222222222222222"
// city tile, 48 x 26
        .balign 4
        .global art_city
art_city:
        .ascii  "................................................"
        .ascii  "......2111......................................"
        .ascii  "......2111..................2211................"
        .ascii  "......2131..................2111................"
        .ascii  "......2111.........211......2131................"
        .ascii  "......2131.........211......2111.......2111....."
        .ascii  ".2211.2111.........231......2131.......2131....."
        .ascii  ".2111.2131....2111.211...21122111......2111....."
        .ascii  ".2131.2111....2131.231...21112131......2131.211."
        .ascii  ".2111.2131....2111.211...21312111.2211.2111.211."
        .ascii  ".2131.2111..2112131.231..21112131.2111.2131.231."
        .ascii  ".2111.21312221112111211..21312111.2131.2111.211."
        .ascii  "2213122111211112131.2311211112131.21112213122312"
        .ascii  "2111112131213112111.2111213112111.21312111112112"
        .ascii  "2131112111211112131.2311211112131221112131112312"
        .ascii  "2111112131213112111.2111213112111211312111112112"
        .ascii  "2131112111211112131.2311211112131213112131112312"
        .ascii  "2111112131213112111.2111213112111211112111112112"
        .ascii  "2131112111211112131.2311211112131213112131112312"
        .ascii  "2111112131213112111.2111213112111211112111112112"
        .ascii  "211111211121111211122111211112111211112111112112"
        .ascii  "211111211121111211122111211112111211112111112112"
        .ascii  "222222222222222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222222222222222"
// bush tile, 36 x 16
        .balign 4
        .global art_bush
art_bush:
        .ascii  "...................................."
        .ascii  "......111.............111..........."
        .ascii  "....1111111.........1111111.....11.."
        .ascii  "..11111111111.....11111111111.11111."
        .ascii  ".1111111111111...1111111111111111111"
        .ascii  "111111111111111.11111111111111111111"
        .ascii  "111111111111111111111111111111111111"
        .ascii  "111111111111111111111111111111111111"
        .ascii  "211111111112111111111111211111111112"
        .ascii  "221111111222211111111112221111111222"
        .ascii  "222111112222221111111222222111112222"
        .ascii  "222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222"
        .ascii  "222222222222222222222222222222222222"
// ground, 24 x 12 repeating; flat dirt fills below it
        .balign 4
        .global art_ground
art_ground:
        .ascii  "000000000000000000000000"
        .ascii  "111111111111222222222222"
        .ascii  "111111111112222222222221"
        .ascii  "111111111122222222222211"
        .ascii  "111111111222222222222111"
        .ascii  "111111112222222222221111"
        .ascii  "111111122222222222211111"
        .ascii  "111111222222222222111111"
        .ascii  "333333333333333333333333"
        .ascii  "000000000000000000000000"
        .ascii  "555555555555555555555555"
        .ascii  "555555555555555555555555"
// score digits at scale 1, 6 x 10, outlined when they are built
        .balign 4
        .global art_big
art_big:
        .ascii  ".++++./++++++/++..++/++..++/++..++/++..++/++..++/++..++/++++++/.++++."
        .ascii  "..++../.+++../++++../..++../..++../..++../..++../..++../++++++/++++++"
        .ascii  ".++++./++++++/++..++/....++/...+++/..+++./.+++../+++.../++++++/++++++"
        .ascii  ".++++./++++++/++..++/....++/..+++./..+++./....++/++..++/++++++/.++++."
        .ascii  "...+++/..++++/.++.++/++..++/++..++/++++++/++++++/....++/....++/....++"
        .ascii  "++++++/++++++/++..../+++++./++++++/....++/....++/++..++/++++++/.++++."
        .ascii  ".++++./++++++/++..../+++++./++++++/++..++/++..++/++..++/++++++/.++++."
        .ascii  "++++++/++++++/....++/...+++/..+++./..++../.+++../.++.../.++.../.++..."
        .ascii  ".++++./++++++/++..++/++..++/.++++./++++++/++..++/++..++/++++++/.++++."
        .ascii  ".++++./++++++/++..++/++..++/++++++/.+++++/....++/....++/++++++/.++++."
// 5 x 7 font: A to Z, 0 to 9, then . : - ! ? / and ^, the flap hint: a triangle with no shaft,
// since a shaft under a small head reads as a cross
        .balign 4
        .global art_font5
art_font5:
        .ascii  ".+++./+...+/+...+/+++++/+...+/+...+/+...+"
        .ascii  "++++./+...+/+...+/++++./+...+/+...+/++++."
        .ascii  ".+++./+...+/+..../+..../+..../+...+/.+++."
        .ascii  "++++./+...+/+...+/+...+/+...+/+...+/++++."
        .ascii  "+++++/+..../+..../++++./+..../+..../+++++"
        .ascii  "+++++/+..../+..../++++./+..../+..../+...."
        .ascii  ".+++./+...+/+..../+.+++/+...+/+...+/.++++"
        .ascii  "+...+/+...+/+...+/+++++/+...+/+...+/+...+"
        .ascii  "+++++/..+../..+../..+../..+../..+../+++++"
        .ascii  "..+++/...+./...+./...+./...+./+..+./.++.."
        .ascii  "+...+/+..+./+.+../++.../+.+../+..+./+...+"
        .ascii  "+..../+..../+..../+..../+..../+..../+++++"
        .ascii  "+...+/++.++/+.+.+/+.+.+/+...+/+...+/+...+"
        .ascii  "+...+/++..+/+.+.+/+..++/+...+/+...+/+...+"
        .ascii  ".+++./+...+/+...+/+...+/+...+/+...+/.+++."
        .ascii  "++++./+...+/+...+/++++./+..../+..../+...."
        .ascii  ".+++./+...+/+...+/+...+/+.+.+/+..+./.++.+"
        .ascii  "++++./+...+/+...+/++++./+.+../+..+./+...+"
        .ascii  ".++++/+..../+..../.+++./....+/....+/++++."
        .ascii  "+++++/..+../..+../..+../..+../..+../..+.."
        .ascii  "+...+/+...+/+...+/+...+/+...+/+...+/.+++."
        .ascii  "+...+/+...+/+...+/+...+/+...+/.+.+./..+.."
        .ascii  "+...+/+...+/+...+/+.+.+/+.+.+/++.++/+...+"
        .ascii  "+...+/+...+/.+.+./..+../.+.+./+...+/+...+"
        .ascii  "+...+/+...+/.+.+./..+../..+../..+../..+.."
        .ascii  "+++++/....+/...+./..+../.+.../+..../+++++"
        .ascii  ".+++./+...+/+..++/+.+.+/++..+/+...+/.+++."
        .ascii  "..+../.++../..+../..+../..+../..+../.+++."
        .ascii  ".+++./+...+/....+/...+./..+../.+.../+++++"
        .ascii  "+++++/...+./..+../...+./....+/+...+/.+++."
        .ascii  "...+./..++./.+.+./+..+./+++++/...+./...+."
        .ascii  "+++++/+..../++++./....+/....+/+...+/.+++."
        .ascii  "..++./.+.../+..../++++./+...+/+...+/.+++."
        .ascii  "+++++/....+/...+./..+../.+.../.+.../.+..."
        .ascii  ".+++./+...+/+...+/.+++./+...+/+...+/.+++."
        .ascii  ".+++./+...+/+...+/.++++/....+/...+./.++.."
        .ascii  "...../...../...../...../...../.++../.++.."
        .ascii  "...../.++../.++../...../.++../.++../....."
        .ascii  "...../...../...../+++++/...../...../....."
        .ascii  "..+../..+../..+../..+../..+../...../..+.."
        .ascii  ".+++./+...+/....+/...+./..+../...../..+.."
        .ascii  "....+/....+/...+./..+../.+.../+..../+...."
        .ascii  "..+../.+++./+++++/...../...../...../....."
// 3 x 5 font for scales 2 to 4, same order
        .balign 4
        .global art_font3
art_font3:
        .ascii  ".+./+.+/+++/+.+/+.+"
        .ascii  "++./+.+/++./+.+/++."
        .ascii  ".++/+../+../+../.++"
        .ascii  "++./+.+/+.+/+.+/++."
        .ascii  "+++/+../++./+../+++"
        .ascii  "+++/+../++./+../+.."
        .ascii  ".++/+../+.+/+.+/.++"
        .ascii  "+.+/+.+/+++/+.+/+.+"
        .ascii  "+++/.+./.+./.+./+++"
        .ascii  "..+/..+/..+/+.+/.+."
        .ascii  "+.+/+.+/++./+.+/+.+"
        .ascii  "+../+../+../+../+++"
        .ascii  "+.+/+++/+++/+.+/+.+"
        .ascii  "++./+.+/+.+/+.+/+.+"
        .ascii  ".+./+.+/+.+/+.+/.+."
        .ascii  "++./+.+/++./+../+.."
        .ascii  ".+./+.+/+.+/++./.++"
        .ascii  "++./+.+/++./+.+/+.+"
        .ascii  ".++/+../.+./..+/++."
        .ascii  "+++/.+./.+./.+./.+."
        .ascii  "+.+/+.+/+.+/+.+/+++"
        .ascii  "+.+/+.+/+.+/+.+/.+."
        .ascii  "+.+/+.+/+++/+++/+.+"
        .ascii  "+.+/+.+/.+./+.+/+.+"
        .ascii  "+.+/+.+/.+./.+./.+."
        .ascii  "+++/..+/.+./+../+++"
        .ascii  "+++/+.+/+.+/+.+/+++"
        .ascii  ".+./++./.+./.+./+++"
        .ascii  "++./..+/.+./+../+++"
        .ascii  "++./..+/.+./..+/++."
        .ascii  "+.+/+.+/+++/..+/..+"
        .ascii  "+++/+../++./..+/++."
        .ascii  ".++/+../+++/+.+/+++"
        .ascii  "+++/..+/.+./.+./.+."
        .ascii  "+++/+.+/+++/+.+/+++"
        .ascii  "+++/+.+/+++/..+/++."
        .ascii  ".../.../.../.../.+."
        .ascii  ".../.+./.../.+./..."
        .ascii  ".../.../+++/.../..."
        .ascii  ".+./.+./.+./.../.+."
        .ascii  "++./..+/.+./.../.+."
        .ascii  "..+/..+/.+./+../+.."
        .ascii  ".+./+++/.../.../..."
// the symbols after the digits, in glyph order
art_symbols:
        .asciz  ".:-!?/^"
// medals: one coin whose three colours the medal picks; 15, 8 and 5 square
        .balign 4
        .global art_medal1
art_medal1:
        .ascii  ".....00000....."
        .ascii  "...003333300..."
        .ascii  "..03322222330.."
        .ascii  ".0344222222230."
        .ascii  ".0342221222230."
        .ascii  "032222111222230"
        .ascii  "032111111111230"
        .ascii  "032211111112230"
        .ascii  "032221111122230"
        .ascii  "032211222112230"
        .ascii  ".0321222221230."
        .ascii  ".0322222222230."
        .ascii  "..03322222330.."
        .ascii  "...003333300..."
        .ascii  ".....00000....."
        .balign 4
        .global art_medal2
art_medal2:
        .ascii  "..0000.."
        .ascii  ".033330."
        .ascii  "03242230"
        .ascii  "03211230"
        .ascii  "03211230"
        .ascii  "03222230"
        .ascii  ".033330."
        .ascii  "..0000.."
// shaded corner to corner: a light centre with darker sides would form a plus
        .balign 4
        .global art_medal3
art_medal3:
        .ascii  ".000."
        .ascii  "01120"
        .ascii  "01230"
        .ascii  "02330"
        .ascii  ".000."
// sparkles over the medal: 5, 3 and 1 square
        .balign 4
        .global art_spark1
art_spark1:
        .ascii  "..4.."
        .ascii  "..4.."
        .ascii  "44444"
        .ascii  "..4.."
        .ascii  "..4.."
        .balign 4
        .global art_spark2
art_spark2:
        .ascii  ".4."
        .ascii  "444"
        .ascii  ".4."
        .balign 4
        .global art_spark3
art_spark3:
        .ascii  "4"
// UI words: each element's word at scales 1 to 4 in turn; an empty word skips that scale.
// A space is a gap and an underscore starts a new line.
        .balign 4
        .global art_ui
art_ui:
        .asciz  "FLAP"
        .asciz  "FLAP"
        .asciz  "FLAP"
        .asciz  "FLAP"
        .asciz  "PRESS SPACE"
        .asciz  "PRESS SPACE"
        .asciz  "PRESS SPACE"
        .asciz  "SPACE"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "GET READY"
        .asciz  "GET READY"
        .asciz  "GET READY"
        .asciz  "READY"
        .asciz  "^"
        .asciz  "^"
        .asciz  "^"
        .asciz  "^"
        .asciz  "SPACE"
        .asciz  "SPACE"
        .asciz  "SPACE"
        .asciz  "SPACE"
        .asciz  "GAME OVER"
        .asciz  "GAME OVER"
        .asciz  "GAME OVER"
        .asciz  "GAME_OVER"
        .asciz  "SCORE"
        .asciz  "SCORE"
        .asciz  "SCORE"
        .asciz  "SCORE"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "BEST"
        .asciz  "MEDAL"
        .asciz  "MEDAL"
        .asciz  ""
        .asciz  ""
        .asciz  "NEW"
        .asciz  "NEW"
        .asciz  "NEW"
        .asciz  ""
        .asciz  "PAUSED"
        .asciz  "PAUSED"
        .asciz  "PAUSED"
        .asciz  "PAUSED"
        .asciz  ""
        .asciz  "ZOOM OUT"
        .asciz  "ZOOM OUT"
        .asciz  "ZOOM OUT"
// per element and scale: font (named by its glyph width), size k, fill slot, outline slot
        .balign 4
        .global art_style
art_style:
        .byte   ART_F5_W, 3, SLOT_WORD, SLOT_TOUT, ART_F5_W, 2, SLOT_WORD, SLOT_TOUT, ART_F3_W, 2, SLOT_WORD, SLOT_TOUT, ART_F3_W, 2, SLOT_WORD, SLOT_TOUT
        .byte   ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT
        .byte   ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT
        .byte   ART_F5_W, 2, SLOT_WORD, SLOT_TOUT, ART_F5_W, 1, SLOT_WORD, SLOT_TOUT, ART_F3_W, 1, SLOT_WORD, SLOT_TOUT, ART_F3_W, 1, SLOT_WORD, SLOT_TOUT
        .byte   ART_F5_W, 2, SLOT_WHITE, SLOT_TOUT, ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT
        .byte   ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT
        .byte   ART_F5_W, 2, SLOT_WORD, SLOT_TOUT, ART_F5_W, 1, SLOT_WORD, SLOT_TOUT, ART_F3_W, 1, SLOT_WORD, SLOT_TOUT, ART_F3_W, 1, SLOT_WORD, SLOT_TOUT
        .byte   ART_F5_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL
        .byte   ART_F5_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL
        .byte   ART_F5_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL, ART_F3_W, 1, SLOT_LABEL, SLOT_PANEL
        .byte   ART_F5_W, 1, SLOT_WHITE, SLOT_NEW, ART_F3_W, 1, SLOT_WHITE, SLOT_NEW, ART_F3_W, 1, SLOT_WHITE, SLOT_NEW, ART_F3_W, 1, SLOT_WHITE, SLOT_NEW
        .byte   ART_F5_W, 2, SLOT_WHITE, SLOT_TOUT, ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT
        .byte   ART_F5_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT, ART_F3_W, 1, SLOT_WHITE, SLOT_TOUT

// legends: character code, slot, ..., 0
        .balign 4
        .global art_l_bird
art_l_bird:
        .byte   48, SLOT_BOUT, 49, SLOT_BODY, 50, SLOT_BSHADE, 51, SLOT_BELLY, 52, SLOT_WING
        .byte   53, SLOT_EYE, 54, SLOT_PUPIL, 55, SLOT_BEAK, 56, SLOT_BEAK2, 0
        .balign 4
        .global art_l_pipe
art_l_pipe:
        .byte   48, SLOT_POUT, 49, SLOT_PLIGHT, 50, SLOT_PMID, 51, SLOT_PDARK, 0
        .balign 4
        .global art_l_cloud
art_l_cloud:
        .byte   49, SLOT_CLOUD, 50, SLOT_CLOUD2, 0
        .balign 4
        .global art_l_city
art_l_city:
        .byte   49, SLOT_CITY, 50, SLOT_CITY2, 51, SLOT_WINDOW, 0
        .balign 4
        .global art_l_bush
art_l_bush:
        .byte   49, SLOT_BUSH, 50, SLOT_BUSH2, 0
        .balign 4
        .global art_l_ground
art_l_ground:
        .byte   48, SLOT_GLINE, 49, SLOT_GRASS, 50, SLOT_GRASS2, 51, SLOT_GRASSDK
        .byte   52, SLOT_DIRT, 53, SLOT_DIRT2, 0
        .balign 4
        .global art_l_medal
art_l_medal:
        .byte   48, SLOT_TOUT, 49, SLOT_MED1, 50, SLOT_MED2, 51, SLOT_MED3, 52, SLOT_WHITE, 0
// scaling down keeps the highest of these in each block: outlines, then eyes, then the bird
        .balign 4
        .global art_prio
art_prio:
        .byte   0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 9, 5, 5, 6, 2, 3
        .byte   9, 6, 4, 6, 9, 7, 7, 7, 7, 8, 8, 8, 8, 7, 9, 5
        .byte   5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
        .byte   5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
// sin and cos in Q14 for tilts of +20 down to -90 degrees in 5 degree steps
        .balign 4
        .global art_trig
art_trig:
        .hword  5604, 15396, 4240, 15826, 2845, 16135, 1428, 16322, 0, 16384, -1428, 16322
        .hword  -2845, 16135, -4240, 15826, -5604, 15396, -6924, 14849, -8192, 14189, -9397, 13421
        .hword  -10531, 12551, -11585, 11585, -12551, 10531, -13421, 9397, -14189, 8192, -14849, 6924
        .hword  -15396, 5604, -15826, 4240, -16135, 2845, -16322, 1428, -16384, 0

        .bss
        .balign 16
        .global art_pal
art_pal:        .skip   ART_PAL_BYTES
art_map:        .skip   ART_MAP_BYTES
art_key:        .skip   8

        .text

// art_decode(x0 = text, x1 = legend, x2 = pixels, x3 = dest): text to slots, 255 transparent
        .balign 4
        .global art_decode
art_decode:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x12, x2
        ldr     x9, =art_map
        mov     x11, SLOT_CLEAR
        ldr     x10, =ART_BYTES8
        mul     x11, x11, x10
        mov     x10, 0
art_decode_clear:
        str     x11, [x9, x10]
        add     x10, x10, 8
        cmp     x10, ART_MAP_BYTES
        b.lt    art_decode_clear
        b       art_decode_ltest
art_decode_legend:
        ldrb    w11, [x1], 1
        strb    w11, [x9, x10]
art_decode_ltest:
        ldrb    w10, [x1], 1
        cbnz    w10, art_decode_legend
        cbz     x2, art_decode_done
art_decode_loop:
        ldrb    w10, [x0], 1
        // a slash only separates glyph rows
        cmp     w10, ART_SLASH
        b.eq    art_decode_loop
        and     w10, w10, ART_CODE_MASK
        ldrb    w11, [x9, x10]
        strb    w11, [x3], 1
        subs    x2, x2, 1
        b.ne    art_decode_loop
        mov     x9, ART_COST_DECODE
        mul     x0, x12, x9
        bl      gfx_breath
art_decode_done:
        ldp     fp, lr, [sp], 16
        ret

// art_build(x0 = theme, x1 = bird colour, x2 = medal 1 to 4 or 0) -> w0 = 1 when art_pal changed
        .balign 4
        .global art_build
art_build:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        // one key per look and never 0, so the first call always builds
        lsl     x9, x2, 2
        add     x9, x9, x0
        lsl     x9, x9, 2
        add     x9, x9, x1
        add     x9, x9, 1
        ldr     x10, =art_key
        ldr     x11, [x10]
        mov     w12, 0
        cmp     x9, x11
        b.eq    art_build_done
        str     x9, [x10]
        ldr     x12, =art_pal
        ldr     x13, =art_day
        mov     x14, 0
art_build_day:
        ldr     w9, [x13, x14]
        str     w9, [x12, x14]
        add     x14, x14, 4
        cmp     x14, ART_PAL_BYTES
        b.lt    art_build_day
        // the bird keeps its colours at night; only the scenery from slot 1 changes
        cbz     x0, art_build_bird
        ldr     x13, =art_night
        add     x15, x12, 4
        mov     x14, 0
art_build_night:
        ldr     w9, [x13, x14]
        str     w9, [x15, x14]
        add     x14, x14, 4
        cmp     x14, ART_NIGHT_BYTES
        b.lt    art_build_night
art_build_bird:
        ldr     x13, =art_birds
        mov     x9, ART_BIRD_BYTES
        madd    x13, x1, x9, x13
        add     x15, x12, ART_BIRD_OFF
        mov     x14, 0
art_build_colour:
        ldr     w9, [x13, x14]
        str     w9, [x15, x14]
        add     x14, x14, 4
        cmp     x14, ART_BIRD_BYTES
        b.lt    art_build_colour
        cbz     x2, art_build_changed
        ldr     x13, =art_medals
        sub     x9, x2, 1
        mov     x10, ART_MEDAL_BYTES
        madd    x13, x9, x10, x13
        add     x15, x12, ART_MEDAL_OFF
        mov     x14, 0
art_build_medal:
        ldr     w9, [x13, x14]
        str     w9, [x15, x14]
        add     x14, x14, 4
        cmp     x14, ART_MEDAL_BYTES
        b.lt    art_build_medal
art_build_changed:
        mov     w12, 1
art_build_done:
        mov     w0, w12
        ldp     fp, lr, [sp], 16
        ret

// art_glyph(w0 = character) -> x0 = its glyph in either font, or -1 for a gap
        .balign 4
        .global art_glyph
art_glyph:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     w9, w0, ART_CHAR_A
        cmp     w9, ART_LETTER_LAST
        b.ls    art_glyph_letter
        sub     w9, w0, ART_CHAR_0
        cmp     w9, ART_DIGIT_LAST
        b.ls    art_glyph_digit
        ldr     x10, =art_symbols
        mov     x11, 0
        b       art_glyph_test
art_glyph_scan:
        cmp     w12, w0
        b.eq    art_glyph_sym
        add     x11, x11, 1
art_glyph_test:
        ldrb    w12, [x10, x11]
        cbnz    w12, art_glyph_scan
        mov     x0, -1
        b       art_glyph_done
art_glyph_letter:
        uxtw    x0, w9
        b       art_glyph_done
art_glyph_digit:
        add     w0, w9, ART_DIGIT0
        uxtw    x0, w0
        b       art_glyph_done
art_glyph_sym:
        add     x0, x11, ART_SYMBOL0
art_glyph_done:
        ldp     fp, lr, [sp], 16
        ret
