//! The m4 scanner against GNU m4 1.4.19, the m4 on the course servers:
//! for each program here, the scanner writes what GNU m4 writes, byte for
//! byte with its comments, and gives each output line the source line
//! `m4 -s` gives it; where GNU m4 stops with an error, the scanner refuses.
//! The expectations are GNU m4's own output for these programs. The
//! programs are small and made up: token lines placed in a short program,
//! hand-written programs for each comment and quote form that differs by
//! order, and one or more for each builtin and argument form.

use aarch64_emulator::frontend::m4_gnu::scan;

enum Gnu {
    /// GNU m4's output and the line `m4 -s` gives each output line.
    Writes(&'static str, &'static [usize]),
    /// GNU m4 stops with an error.
    Fails,
}

struct Case {
    name: &'static str,
    source: &'static str,
    gnu: Gnu,
}

const CASES: &[Case] = &[
    Case {
        name: "a token line alone: \";x#/*//\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            ;x#/*//\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                ;x#/*//\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line alone: \"dnl\\t\\\"/*\\\\\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            dnl\t\"/*\\\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line alone: \"//dnlm`'\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            //dnlm`'\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                //dnlm\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line after an instruction: \";'m/*//\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1 ;'m/*//\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 ;'w0/*//\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a token line after an instruction: \"//\\\"#dnl\\t\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1 //\"#dnl\t\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 //\"#dnl\t\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a token line after an instruction: \"//\\\\x\\t*/\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1 //\\x\t*/\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 //\\x\t*/\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a token line after an instruction: \"\\t;*/`'\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1 \t;*/`'\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 \t;*/\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a token line as an operand: \"\\tm//*/;\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            \tmov w0, \tm//*/;\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, \tw0//*/;\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line as an operand: \"m//`'\\\\\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            \tmov w0, m//`'\\\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, w0//\\\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line as an operand: \"m//#xdnl\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            \tmov w0, m//#xdnl\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, w0//#xdnl\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line as an operand: \"m//;#\\\"\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            \tmov w0, m//;#\"\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, w0//;#\"\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "a token line after an open block comment: \"/*// | \\t'x\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            /*//\n\
            \t'x\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /*//\n\
                \t'x\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a token line after an open block comment: \"/*; | mdnl\\\\\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            /*;\n\
            mdnl\\\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /*;\n\
                mdnl\\\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a token line after an open block comment: \"/*\\\" | /*#\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            /*\"\n\
            /*#\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /*\"\n\
                /*#\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a token line after an open block comment: \"/*' | `\\t'\"",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            /*'\n\
            `\t'\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /*'\n\
                \t\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a body comment naming a macro defined after the body",
        source: "define(`x', `mov w0, 1 // later')\n\
            define(`later', `dnl')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // \tmov w0, 5\n\
                \tret\n",
            &[1, 3, 4, 5, 6, 8],
        ),
    },
    Case {
        name: "a body comment naming a macro defined after the body, no dnl",
        source: "define(`x', `mov w0, 1 // later')\n\
            define(later, dnl)\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "a body comment naming a macro redefined before the use",
        source: "define(`later', `w1')dnl\n\
            define(`x', `mov w0, 1 // later')\n\
            define(`later', `dnl')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // \tmov w0, 5\n\
                \tret\n",
            &[2, 4, 5, 6, 7, 9],
        ),
    },
    Case {
        name: "a two-line quoted body whose block comment holds an apostrophe",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            /* it's */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /* its */ mov w1\n\
                \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 7, 8, 9],
        ),
    },
    Case {
        name: "a two-line quoted body with an apostrophe, no dnl",
        source: "define(`x', `mov w0, 1\n\
            /* it's */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /* its */ mov w1\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 6, 7, 8],
        ),
    },
    Case {
        name: "a two-line quoted body with a plain block comment",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            /* c */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /* c */ mov w1, 2\n\
                \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 7, 8, 9],
        ),
    },
    Case {
        name: "a two-line quoted body whose block comment holds dnl",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            /* dnl */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /* \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 7, 9],
        ),
    },
    Case {
        name: "a // built by a quoted macro, then dnl",
        source: "define(`sl', `/')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "a // built by an unquoted macro, then dnl",
        source: "define(sl, /)\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "a // built by joining two arguments",
        source: "define(`cat', `$1$2')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 cat(/,/) dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "a // built on a line with a quoted operand",
        source: "define(`sl', `/')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, `3' sl/ dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "a double quote built by a quoted macro inside a string",
        source: "define(`dq', `\"')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3\n\
            \tb 1f\n\
            \t.ascii \"a dq // dnl\"\n\
            \tmov w0, 5\n\
            1:\tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3\n\
                \tb 1f\n\
                \t.ascii \"a \" // \tmov w0, 5\n\
                1:\tret\n",
            &[2, 3, 4, 5, 6, 7, 9],
        ),
    },
    Case {
        name: "a double quote built by an unquoted macro inside a string",
        source: "define(dq, \")\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3\n\
            \tb 1f\n\
            \t.ascii \"a dq // dnl\"\n\
            \tmov w0, 5\n\
            1:\tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3\n\
                \tb 1f\n\
                \t.ascii \"a \" // \tmov w0, 5\n\
                1:\tret\n",
            &[1, 2, 3, 4, 5, 6, 7, 9],
        ),
    },
    Case {
        name: "a // and a dnl both built by macros",
        source: "define(`sl', `/')dnl\n\
            define(`nl', `dnl')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ nl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 8],
        ),
    },
    Case {
        name: "a // built by a macro, then divert(-1)",
        source: "define(`sl', `/')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ divert(-1)\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // ",
            &[2, 3, 4, 5],
        ),
    },
    Case {
        name: "a quoted operand before a // comment",
        source: "define(a, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, `5' // c\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 5 // c\n\
                \tret\n",
            &[2, 3, 4, 5, 6],
        ),
    },
    Case {
        name: "a quoted operand before a ; comment",
        source: "define(a, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, `5' ; c\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 5 ; c\n\
                \tret\n",
            &[2, 3, 4, 5, 6],
        ),
    },
    Case {
        name: "a body comment naming a redefined macro, no dnl",
        source: "define(`later', `w1')\n\
            define(`x', `mov w0, 1 // later')\n\
            define(`later', `dnl')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \n\
                \n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 5, 6, 7, 9],
        ),
    },
    Case {
        name: "a body comment naming a macro defined between the body and the use",
        source: "define(`x', `mov w0, 1 // later')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            define(`later', `dnl')dnl\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 6, 8],
        ),
    },
    Case {
        name: "a two-line quoted body whose block comment holds a backtick",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            /* it`s */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "an unused two-line quoted body with an apostrophe",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            /* it's */ mov w1, 2')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a // built by a macro, then a quote",
        source: "define(a, w0)dnl\n\
            define(sl, /)\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ `x'\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // x\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a dnl header line and a // built by a macro",
        source: "dnl a header\n\
            define(sl, /)\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl/ dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 6, 8],
        ),
    },
    Case {
        name: "a // built by a quoted macro on the bare-metal path",
        source: "define(`sl', `/')dnl\n\
            \tmov x0, 3 sl/ dnl\n\
            \tmov x0, 5\n\
            \tmov x8, 93\n\
            \tsvc 0\n",
        gnu: Gnu::Writes(
            "\tmov x0, 3 // \tmov x0, 5\n\
                \tmov x8, 93\n\
                \tsvc 0\n",
            &[2, 4, 5],
        ),
    },
    Case {
        name: "a // built by an unquoted macro on the bare-metal path",
        source: "define(sl, /)\n\
            \tmov x0, 3 sl/ dnl\n\
            \tmov x0, 5\n\
            \tmov x8, 93\n\
            \tsvc 0\n",
        gnu: Gnu::Writes(
            "\n\
                \tmov x0, 3 // \tmov x0, 5\n\
                \tmov x8, 93\n\
                \tsvc 0\n",
            &[1, 2, 4, 5],
        ),
    },
    Case {
        name: "a body of two slashes, then dnl",
        source: "define(`sl2', `//')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 sl2 dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "a // built from an argument",
        source: "define(`f', `$1/')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 3 f(/) dnl\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 3 // \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7],
        ),
    },
    Case {
        name: "divert(-1) over a define with a // comment",
        source: "divert(-1)\n\
            define(a, w0) // c\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define, dnl and a // comment",
        source: "divert(-1)\n\
            define(a, w0)dnl // c\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define with a // comment holding dnl",
        source: "divert(-1)\n\
            define(a, w0) // c dnl\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define with a ; comment",
        source: "divert(-1)\n\
            define(a, w0) ; c\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define, dnl and a ; comment",
        source: "divert(-1)\n\
            define(a, w0)dnl ; c\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define with a block comment",
        source: "divert(-1)\n\
            define(a, w0) /* c */\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over a define, dnl and a block comment",
        source: "divert(-1)\n\
            define(a, w0)dnl /* c */\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) over an undefine, dnl and a // comment",
        source: "define(a, w0)\n\
            divert(-1)\n\
            undefine(`a')dnl // c\n\
            define(a, w1)dnl\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tmov w0, w1\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w1, 2\n\
                \tmov w0, w1\n\
                \tret\n",
            &[1, 5, 6, 7, 8, 9, 10, 11],
        ),
    },
    Case {
        name: "divert(-1) over a dnl line with //",
        source: "divert(-1)\n\
            dnl // c\n\
            define(a, w0)\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "divert(-1) over a dnl line with a block comment",
        source: "divert(-1)\n\
            dnl /* c */\n\
            define(a, w0)\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "divert(-1) over a two-line quoted define holding //",
        source: "divert(-1)\n\
            define(`body', `mov w0, 1 // one\n\
            \tmov w0, 2')dnl\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tbody\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // one\n\
                \tmov w0, 2\n\
                \tret\n",
            &[4, 5, 6, 7, 8, 8, 9],
        ),
    },
    Case {
        name: "divert(-1) over a # comment line",
        source: "divert(-1)\n\
            # a note\n\
            define(a, w0)\n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[4, 5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "divert(-1) over blank lines",
        source: "divert(-1)\n\
            \n\
            define(a, w0)\n\
            \n\
            divert\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov a, 2\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 2\n\
                \tret\n",
            &[5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a body comment naming a macro that expands to changecom",
        source: "define(`x', `mov w0, 1 // later')dnl\n\
            define(`later', `changecom')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5 # c\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // \n\
                \tmov w0, 5 # c\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 8],
        ),
    },
    Case {
        name: "a body comment ending in a call left open",
        source: "define(`x', `mov w0, 1 // f(')dnl\n\
            define(`f', `$1')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5)\n\
            \tmov w0, 6\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 // mov w0\n\
                \tmov w0, 6\n\
                \tret\n",
            &[3, 4, 5, 6, 8, 9],
        ),
    },
    Case {
        name: "a body ; comment naming a macro that expands to dnl",
        source: "define(`x', `mov w0, 1 ; later')dnl\n\
            define(`later', `dnl')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1 ; \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 8],
        ),
    },
    Case {
        name: "a two-line quoted body closed inside a block comment",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            \tmov w1, 2 /* don't */ mov w0, 7')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w1, 2 /* dont */ mov w0\n\
                \tmov w0, 5\n\
                \tret\n",
            &[3, 4, 5, 6, 7, 7, 8, 9],
        ),
    },
    Case {
        name: "a three-line quoted body with an apostrophe in a block comment",
        source: "define(a, w0)dnl\n\
            define(`x', `mov w0, 1\n\
            \tmov w1, 2\n\
            /* it's */ mov w2, 3')\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tx\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\n\
                \t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w1, 2\n\
                /* its */ mov w2\n\
                \tmov w0, 5\n\
                \tret\n",
            &[4, 5, 6, 7, 8, 8, 8, 9, 10],
        ),
    },
    Case {
        name: "dnl deletes the block comment opener after it",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            dnl /* start\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7, 8, 9, 10, 11],
        ),
    },
    Case {
        name: "dnl deletes a block comment opener glued to it",
        source: "define(m, w0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            dnl/*\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[2, 3, 4, 5, 7, 8, 9, 10, 11],
        ),
    },
    Case {
        name: "a define's dnl deletes the block comment opener after it",
        source: "\t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            define(a, w0)dnl /* c\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "dnl is the program's only new form, before a block comment opener",
        source: "\t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            dnl /* start\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a block comment opener with no dnl",
        source: "\t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            /* start\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                /* start\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "changecom, then dnl before a block comment opener",
        source: "\t.text\n\
            \t.global main\n\
            main:\n\
            \tmov w0, 1\n\
            changecom(`@')dnl /* c\n\
            \tmov w0, 7\n\
            \tret\n\
            \t// */\n\
            \tmov w0, 5\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w0, 7\n\
                \tret\n\
                \t// */\n\
                \tmov w0, 5\n\
                \tret\n",
            &[1, 2, 3, 4, 6, 7, 8, 9, 10],
        ),
    },
    Case {
        name: "a quote that spans lines",
        source: "l1\n\
            `q2\n\
            q3' after\n\
            l4\n",
        gnu: Gnu::Writes(
            "l1\n\
                q2\n\
                q3 after\n\
                l4\n",
            &[1, 2, 3, 4],
        ),
    },
    Case {
        name: "a call whose arguments close two lines down",
        source: "define(`f', `[$1|$2]')dnl\n\
            l2\n\
            f(a,\n\
            b\n\
            ) tail\n\
            l6\n",
        gnu: Gnu::Writes(
            "l2\n\
                [a|b\n\
                ] tail\n\
                l6\n",
            &[2, 3, 3, 6],
        ),
    },
    Case {
        name: "dnl joins the next line on",
        source: "l1 dnl x\n\
            l2\n\
            l3dnl\n\
            l4\n",
        gnu: Gnu::Writes(
            "l1 l2\n\
                l3dnl\n\
                l4\n",
            &[1, 3, 4],
        ),
    },
    Case {
        name: "a word read on from the end of an expansion",
        source: "define(`f', `x')dnl\n\
            f(\n\
            a)f\n\
            l3\n",
        gnu: Gnu::Writes(
            "xf\n\
                l3\n",
            &[2, 4],
        ),
    },
    Case {
        name: "divert to the diversion in use changes nothing",
        source: "a\n\
            divert(0)\n\
            b\n\
            divert(-1)divert\n\
            c\n",
        gnu: Gnu::Writes(
            "a\n\
                \n\
                b\n\
                \n\
                c\n",
            &[1, 2, 3, 4, 5],
        ),
    },
    Case {
        name: "the file line after an expansion ending in a newline",
        source: "define(`f', `[$1]\n\
            ')dnl\n\
            l2\n\
            f(a,\n\
            b\n\
            )tail\n\
            l6\n",
        gnu: Gnu::Writes(
            "l2\n\
                [a]\n\
                tail\n\
                l6\n",
            &[3, 4, 6, 7],
        ),
    },
    Case {
        name: "an expansion's last word read on into the file",
        source: "define(`g', `G\n\
            ')dnl\n\
            define(`f', `F\n\
            g')dnl\n\
            f(\n\
            )T\n\
            l5\n",
        gnu: Gnu::Writes(
            "F\n\
                gT\n\
                l5\n",
            &[5, 5, 7],
        ),
    },
    Case {
        name: "an empty quote starts a line",
        source: "x\n\
            `'`'a\n\
            define(`e', `')e\n\
            foo\n\
            \x20 e()bar\n\
            e\n",
        gnu: Gnu::Writes(
            "x\n\
                a\n\
                \n\
                foo\n\
                \x20 bar\n\
                \n",
            &[1, 2, 3, 4, 5, 6],
        ),
    },
    Case {
        name: "arguments: leading blanks go, quotes and parens keep commas",
        source: "define(`f', `[$1][$2][$3]')dnl\n\
            f( a ,\n\
            \tb\t, `c, d' )\n\
            f((x, y), z)\n\
            f\n\
            f()\n",
        gnu: Gnu::Writes(
            "[a ][b\t][c, d ]\n\
                [(x, y)][z][]\n\
                [][][]\n\
                [][][]\n",
            &[2, 4, 5, 6],
        ),
    },
    Case {
        name: "$0, $#, $*, $@ and a missing argument",
        source: "define(`f', `$0 $# [$*] [$@] [$5]')dnl\n\
            f(a, `b,c', d)\n\
            f\n\
            f()\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "$10 is the tenth argument",
        source: "define(`f', `$10|$1')dnl\n\
            f(1,2,3,4,5,6,7,8,9,ten)\n",
        gnu: Gnu::Writes(
            "ten|1\n",
            &[2],
        ),
    },
    Case {
        name: "a $ before no digit or sign stays",
        source: "define(`f', `$x $$1 $')dnl\n\
            f(a)\n",
        gnu: Gnu::Writes(
            "$x $a $\n",
            &[2],
        ),
    },
    Case {
        name: "a call in an argument runs first",
        source: "define(`g', `G')dnl\n\
            define(`f', `<$1>')dnl\n\
            f(g g(1))\n",
        gnu: Gnu::Writes(
            "<G G>\n",
            &[3],
        ),
    },
    Case {
        name: "a define in an argument",
        source: "define(`f', `$1')dnl\n\
            f(define(`h', `H'))h\n",
        gnu: Gnu::Writes(
            "H\n",
            &[2],
        ),
    },
    Case {
        name: "a # comment in an argument is kept",
        source: "define(`f', `<$1>')dnl\n\
            f(a # b, c\n\
            )\n",
        gnu: Gnu::Writes(
            "<a # b, c\n\
                >\n",
            &[2, 2],
        ),
    },
    Case {
        name: "divnum under each diversion",
        source: "divnum\n\
            divert(-1)divnum\n\
            divert(0)divnum\n\
            divert(-2)x\n\
            divert()divnum\n",
        gnu: Gnu::Writes(
            "0\n\
                0\n\
                0\n",
            &[1, 3, 5],
        ),
    },
    Case {
        name: "dnl with arguments, and at the end of the file",
        source: "a dnl(x) b\n\
            c\n\
            d dnl",
        gnu: Gnu::Writes(
            "a c\n\
                d ",
            &[1, 3],
        ),
    },
    Case {
        name: "undefine a user macro and a builtin",
        source: "define(`m', `M')dnl\n\
            undefine(`m', `dnl')dnl\n\
            m dnl x\n",
        gnu: Gnu::Writes(
            "dnl\n\
                m dnl x\n",
            &[2, 3],
        ),
    },
    Case {
        name: "define with no body and with an extra argument",
        source: "define(`a')define(`b', `B', `extra')[a][b]\n",
        gnu: Gnu::Writes(
            "[][B]\n",
            &[1],
        ),
    },
    Case {
        name: "builtins m4 calls only with ( stay words without it",
        source: "builtin decr define defn errprint esyscmd eval format ifdef ifelse include incr index indir len m4wrap maketemp mkstemp patsubst popdef pushdef regexp shift sinclude substr syscmd translit undefine\n",
        gnu: Gnu::Writes(
            "builtin decr define defn errprint esyscmd eval format ifdef ifelse include incr index indir len m4wrap maketemp mkstemp patsubst popdef pushdef regexp shift sinclude substr syscmd translit undefine\n",
            &[1],
        ),
    },
    Case {
        name: "__gnu__ and __unix__ expand to nothing, unix and changeword do not",
        source: "[__gnu__][__unix__][unix][changeword][__gnu__(x)]\n",
        gnu: Gnu::Writes(
            "[][][unix][changeword][]\n",
            &[1],
        ),
    },
    Case {
        name: "changecom forms",
        source: "define(m,X)dnl\n\
            changecom(`@', `')@ m\n\
            m\n\
            changecom(`', `!')# m @ m ! m\n\
            changecom(`@')@ m ! m\n\
            m\n\
            changecom()# m @ m\n\
            changecom(`ab', `cd')a m ab m c m cd m\n\
            changecom(`/*', `*/', `z')/* m\n\
            \x20m */ m\n\
            changecom(`#')`$1' divnum\n",
        gnu: Gnu::Writes(
            "@ m\n\
                X\n\
                # X @ X ! X\n\
                @ m ! m\n\
                X\n\
                # X @ X\n\
                a X ab m c m cd X\n\
                /* m\n\
                \x20m */ X\n\
                $1 0\n",
            &[2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        ),
    },
    Case {
        name: "changecom with three-character strings",
        source: "define(`m', `M')dnl\n\
            changecom(`abc', `xyz')dnl\n\
            ab m abc m xy m xyz m\n\
            +abc+ m\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "a comment that opens with ( stops a call taking arguments",
        source: "define(`f', `F')dnl\n\
            changecom(`(')dnl\n\
            f(x) m\n\
            f\n",
        gnu: Gnu::Writes(
            "F(x) m\n\
                F\n",
            &[3, 4],
        ),
    },
    Case {
        name: "changecom with no arguments turns comments off",
        source: "define(`m', `M')dnl\n\
            changecom\n\
            # m\n",
        gnu: Gnu::Writes(
            "\n\
                # M\n",
            &[2, 3],
        ),
    },
    Case {
        name: "words: a digit ends one, an underscore joins",
        source: "define(`a', `A')dnl\n\
            a1 1a _a a_ a.a a-a\n",
        gnu: Gnu::Writes(
            "a1 1A _a a_ A.A A-A\n",
            &[2],
        ),
    },
    Case {
        name: "dnl redefined before its own use",
        source: "define(`dnl', `D')dnl x\n\
            foo dnl bar\n",
        gnu: Gnu::Writes(
            "D x\n\
                foo D bar\n",
            &[1, 2],
        ),
    },
    Case {
        name: "quotes nest, and a lone close quote is text",
        source: "`a `b' c' it's\n",
        gnu: Gnu::Writes(
            "a `b' c it's\n",
            &[1],
        ),
    },
    Case {
        name: "a quoted define body spanning lines, used twice",
        source: "define(`two', `mov w0, 1\n\
            \tmov w1, 2')dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \ttwo\n\
            \ttwo\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tmov w0, 1\n\
                \tmov w1, 2\n\
                \tmov w0, 1\n\
                \tmov w1, 2\n\
                \tret\n",
            &[3, 4, 5, 6, 6, 7, 7, 8],
        ),
    },
    Case {
        name: "divert(-1) around defines, then the program",
        source: "divert(-1)\n\
            define(`fp', `x29')\n\
            define(`lr', `x30')\n\
            divert(0)dnl\n\
            \t.text\n\
            \t.global main\n\
            main:\n\
            \tstp fp, lr, [sp, -16]!\n\
            \tret\n",
        gnu: Gnu::Writes(
            "\t.text\n\
                \t.global main\n\
                main:\n\
                \tstp x29, x30, [sp, -16]!\n\
                \tret\n",
            &[5, 6, 7, 8, 9],
        ),
    },
    Case {
        name: "an unclosed argument list",
        source: "define(`f', `x')dnl\n\
            f(a,\n\
            b\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "an unclosed comment changecom set",
        source: "changecom(`/*', `*/')dnl\n\
            /* open\n",
        gnu: Gnu::Fails,
    },
    Case {
        name: "a # comment with no newline at the end of the file",
        source: "a # c",
        gnu: Gnu::Fails,
    },
    Case {
        name: "an unclosed quote",
        source: "a\n\
            `open\n\
            b\n",
        gnu: Gnu::Fails,
    },
];

/// Builtins GNU m4 runs and the playground does not: (case, source, line,
/// what the refusal names).
const REFUSED: &[(&str, &str, usize, &str)] = &[
    ("__file__ alone is refused", "a\n\
            __file__\n", 2, "__file__"),
    ("__line__ alone is refused", "a\n\
            __line__\n", 2, "__line__"),
    ("__program__ alone is refused", "a\n\
            __program__\n", 2, "__program__"),
    ("changequote alone is refused", "a\n\
            changequote\n", 2, "changequote"),
    ("debugfile alone is refused", "a\n\
            debugfile\n", 2, "debugfile"),
    ("debugmode alone is refused", "a\n\
            debugmode\n", 2, "debugmode"),
    ("dumpdef alone is refused", "a\n\
            dumpdef\n", 2, "dumpdef"),
    ("m4exit alone is refused", "a\n\
            m4exit\n", 2, "m4exit"),
    ("sysval alone is refused", "a\n\
            sysval\n", 2, "sysval"),
    ("traceoff alone is refused", "a\n\
            traceoff\n", 2, "traceoff"),
    ("traceon alone is refused", "a\n\
            traceon\n", 2, "traceon"),
    ("undivert alone is refused", "a\n\
            undivert\n", 2, "undivert"),
    ("builtin() is refused", "a\n\
            builtin(`x')\n", 2, "builtin"),
    ("decr() is refused", "a\n\
            decr(`x')\n", 2, "decr"),
    ("defn() is refused", "a\n\
            defn(`x')\n", 2, "defn"),
    ("errprint() is refused", "a\n\
            errprint(`x')\n", 2, "errprint"),
    ("esyscmd() is refused", "a\n\
            esyscmd(`x')\n", 2, "esyscmd"),
    ("eval() is refused", "a\n\
            eval(`x')\n", 2, "eval"),
    ("format() is refused", "a\n\
            format(`x')\n", 2, "format"),
    ("ifdef() is refused", "a\n\
            ifdef(`x')\n", 2, "ifdef"),
    ("ifelse() is refused", "a\n\
            ifelse(`x')\n", 2, "ifelse"),
    ("include() is refused", "a\n\
            include(`x')\n", 2, "include"),
    ("incr() is refused", "a\n\
            incr(`x')\n", 2, "incr"),
    ("index() is refused", "a\n\
            index(`x')\n", 2, "index"),
    ("indir() is refused", "a\n\
            indir(`x')\n", 2, "indir"),
    ("len() is refused", "a\n\
            len(`x')\n", 2, "len"),
    ("m4wrap() is refused", "a\n\
            m4wrap(`x')\n", 2, "m4wrap"),
    ("maketemp() is refused", "a\n\
            maketemp(`x')\n", 2, "maketemp"),
    ("mkstemp() is refused", "a\n\
            mkstemp(`x')\n", 2, "mkstemp"),
    ("patsubst() is refused", "a\n\
            patsubst(`x')\n", 2, "patsubst"),
    ("popdef() is refused", "a\n\
            popdef(`x')\n", 2, "popdef"),
    ("pushdef() is refused", "a\n\
            pushdef(`x')\n", 2, "pushdef"),
    ("regexp() is refused", "a\n\
            regexp(`x')\n", 2, "regexp"),
    ("shift() is refused", "a\n\
            shift(`x')\n", 2, "shift"),
    ("sinclude() is refused", "a\n\
            sinclude(`x')\n", 2, "sinclude"),
    ("substr() is refused", "a\n\
            substr(`x')\n", 2, "substr"),
    ("syscmd() is refused", "a\n\
            syscmd(`x')\n", 2, "syscmd"),
    ("translit() is refused", "a\n\
            translit(`x')\n", 2, "translit"),
    ("__file__() is refused", "a\n\
            __file__(`x')\n", 2, "__file__"),
    ("__line__() is refused", "a\n\
            __line__(`x')\n", 2, "__line__"),
    ("__program__() is refused", "a\n\
            __program__(`x')\n", 2, "__program__"),
    ("changequote() is refused", "a\n\
            changequote(`x')\n", 2, "changequote"),
    ("debugfile() is refused", "a\n\
            debugfile(`x')\n", 2, "debugfile"),
    ("debugmode() is refused", "a\n\
            debugmode(`x')\n", 2, "debugmode"),
    ("dumpdef() is refused", "a\n\
            dumpdef(`x')\n", 2, "dumpdef"),
    ("m4exit() is refused", "a\n\
            m4exit(`x')\n", 2, "m4exit"),
    ("sysval() is refused", "a\n\
            sysval(`x')\n", 2, "sysval"),
    ("traceoff() is refused", "a\n\
            traceoff(`x')\n", 2, "traceoff"),
    ("traceon() is refused", "a\n\
            traceon(`x')\n", 2, "traceon"),
    ("undivert() is refused", "a\n\
            undivert(`x')\n", 2, "undivert"),
    ("a numbered diversion is refused", "divert(1)x\n", 1, "divert(1)"),
    ("a diversion that is not a number is refused", "divert(x)\n", 1, "divert(x)"),
    ("a diversion with a plus sign is refused", "divert(+1)\n", 1, "divert(+1)"),
];

#[test]
fn the_scanner_writes_what_gnu_m4_writes() {
    let mut wrong = Vec::new();
    for case in CASES {
        match (scan(case.source), &case.gnu) {
            (Ok(got), Gnu::Writes(text, lines)) => {
                if got.text != *text || got.lines != *lines {
                    wrong.push(format!("{}: wrote {:?} with lines {:?}", case.name, got.text, got.lines));
                }
            }
            (Err(_), Gnu::Fails) => {}
            (Ok(got), Gnu::Fails) => wrong.push(format!("{}: GNU m4 stops, the scanner wrote {:?}", case.name, got.text)),
            (Err(e), Gnu::Writes(..)) => wrong.push(format!("{}: refused: {e}", case.name)),
        }
    }
    assert!(wrong.is_empty(), "{} of {} programs differ from GNU m4 1.4.19:\n{}", wrong.len(), CASES.len(), wrong.join("\n"));
}

#[test]
fn builtins_the_playground_does_not_run_are_refused_by_name() {
    let mut wrong = Vec::new();
    for &(name, source, line, what) in REFUSED {
        let want = format!("preprocess error at line {line}: unsupported m4 construct: {what}");
        match scan(source) {
            Err(e) if e.to_string() == want => {}
            other => wrong.push(format!("{name}: {other:?}")),
        }
    }
    assert!(wrong.is_empty(), "{} of {} refusals differ:\n{}", wrong.len(), REFUSED.len(), wrong.join("\n"));
}
