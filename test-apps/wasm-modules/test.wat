;; Simple WebAssembly module for testing
;; Exports: add(i32, i32) -> i32
;; Exports: fib(i32) -> i32 (fibonacci, for CPU limit testing)

(module
  ;; Add two integers
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )
  (export "add" (func $add))
  
  ;; Fibonacci - CPU intensive for timeout testing
  (func $fib (param $n i32) (result i32)
    (if (result i32)
      (i32.lt_s (local.get $n) (i32.const 2))
      (then
        local.get $n
      )
      (else
        (i32.add
          (call $fib (i32.sub (local.get $n) (i32.const 1)))
          (call $fib (i32.sub (local.get $n) (i32.const 2)))
        )
      )
    )
  )
  (export "fib" (func $fib))
  
  ;; Memory for data exchange
  (memory (export "memory") 1)
  
  ;; Store string in memory
  (data (i32.const 0) "Hello from WASM")
)
