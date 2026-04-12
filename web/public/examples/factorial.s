// factorial -- compute 5! = 120
//
// X0 = n (counts down from 5)
// X1 = accumulator (result)

    MOV X0, #5         // n = 5
    MOV X1, #1         // result = 1
loop:
    MUL X1, X1, X0     // result = result * n
    SUBS X0, X0, #1    // n = n - 1
    B.GT loop           // repeat while n > 0
    SVC #0              // halt -- X1 = 120
