// fibonacci -- compute the 10th fibonacci number (55)
//
// X0 = fib(n-2), X1 = fib(n-1), X2 = counter, X3 = temp
// Each loop iteration advances n by one, so we need 9 iterations to
// go from fib(1) -> fib(10).

    MOV X0, #0         // fib(0) = 0
    MOV X1, #1         // fib(1) = 1
    MOV X2, #9         // 9 iterations to reach fib(10)
loop:
    ADD X3, X0, X1     // next = prev2 + prev1
    MOV X0, X1         // shift: prev2 = prev1
    MOV X1, X3         // prev1 = next
    SUBS X2, X2, #1    // counter--
    B.GT loop
    SVC #0              // halt -- X1 = 55
