// gcd -- compute GCD(48, 18) = 6 using Euclidean algorithm
//
// X0 = a, X1 = b

    MOV X0, #48
    MOV X1, #18

gcd_loop:
    CMP X1, #0
    B.EQ done

    // X2 = a % b (using division and multiply-subtract)
    UDIV X2, X0, X1     // X2 = a / b
    MUL X2, X2, X1      // X2 = (a / b) * b
    SUB X2, X0, X2      // X2 = a - (a/b)*b = a % b

    MOV X0, X1           // a = b
    MOV X1, X2           // b = remainder
    B gcd_loop

done:
    SVC #0               // halt -- X0 = 6
