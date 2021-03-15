---
title: "Simulating digital circuits in Racket"
author: Guillaume Savaton
lang: en
date: 2021-03-14
draft: false
collection:
- posts
- stories
tags: Racket, Digital electronics
layout: post.njk
katex: true
---

In the series [My first domain-specific language with Racket](/2020/11/08/my-first-domain-specific-language-with-racket/),
I have created a simple hardware description language (HDL) called Tiny-HDL.
The intent of the series was to illustrate the techniques for creating a domain-specific
language in Racket, from parsing to code generation, with a focus on name resolution
and semantic checking.
In this post, I will focus on the runtime aspects: how can we *simulate* a digital
circuit description in Racket.

<!-- more -->

Functional modeling of digital circuits
=======================================

In this post, I focus on [Register-Transfer Level (RTL)](https://en.wikipedia.org/wiki/Register-transfer_level)
simulation of digital circuits with the following restrictions:
there is only one clock domain and
no [three-state logic](https://en.wikipedia.org/wiki/Three-state_logic).

At the Register-Transfer Level, such a circuit has the following
general structure:

![Architecture of a synchronous digital circuit](/assets/figures/digital-circuits-racket/synchronous-architecture.svg)

where:

* A register stores the current state $$s_n$$ and updates it on every clock tick.
* $$f_T$$ is the *transition function* that computes the *next* state
  from the inputs and the current state:\
  $$s_{n+1} = f_T(x_n, s_n)$$.
* $$f_O$$ is the *output function* that computes the current outputs
  from the inputs and the current state:\
  $$y_n = f_O(x_n, s_n)$$.

$$f_T$$ and $$f_Q$$ are both pure functions.
The only memory element is the register.

Several special cases of such circuits can be mentioned:

* A [combinational circuit](https://en.wikipedia.org/wiki/Combinational_logic)
  has no clock and no memory: $$y = f_O(x)$$.
* In a [Medvedev machine](https://en.wikipedia.org/wiki/Finite-state_machine#Hardware_applications),
  the output is the current state: $$y_n = s_n$$.
* In a [Moore machine](https://en.wikipedia.org/wiki/Moore_machine),
  the output is computed only from the current state: $$y_n = f_O(s_n)$$.
* A [Mealy machine](https://en.wikipedia.org/wiki/Mealy_machine)
  is the general case where $$y_n = f_O(x_n, s_n)$$.

Combinational circuits
----------------------

Modeling combinational circuits in a programming language can be
fairly straightforward, but there are pitfalls.
The developer must keep in mind that the program will not be executed
as a sequence of operations, but will be synthesized into an interconnection
of hardware components working concurrently.

As a consequence, the program must be expandable into a dataflow graph
with a finite number of operations and no feedback loop.
Recursion and looping constructs can be problematic if they cannot be fully
unrolled: the maximum number of iterations must be known at compile time.

For instance, if I had to describe a circuit that computes the greatest
common divisor of two positive numbers using Euclid's algorithm, a recursive
implementation would look like this:

```racket
(define (gcd a b)
  (cond [(> a b) (gcd (- a b) b)]
        [(> b a) (gcd a (- b a))]
        [else    a]))

(gcd 143 91)
; 13
```

Since the actual number of comparisons and subtractions depends on `a` and `b`
themselves, we cannot infer the number of components that will be needed to
implement this function as a combinational circuit.
But if we know the maximum value `N` that `a` and `b` can take, we can rewrite this
function with an iterative algorithm.

In the following example:

* `gcd-step` processes a pair `(a, b)` and produces a new pair for the the next step;
* `gcd` calls `gcd-step` repeatedly `N-1` times;
  each result of `gcd-step` is passed as arguments to the next call.

```racket
(define (gcd-step a b)
  (cond [(> a b) (values (- a b) b)]
        [(> b a) (values a (- b a))]
        [else    (values a b)]))

(define (gcd N a b)
  (for/fold ([a^ a] [b^ b] #:result a^)
            ([i (sub1 N)])
    (gcd-step a^ b^)))
```

If we unroll the loop, we can synthesize `gcd` as a cascade of `N-1`
instances of `gcd-step`.
The function `gcd-step` itself can easily be synthesized into a combinational
circuit with two inputs and two outputs.

![Combinational implementation of the GCD](/assets/figures/digital-circuits-racket/gcd-comb.svg)

Sequential circuits
-------------------

When synthesizing a combinational circuit, iterative algorithms are translated
into **spatially** replicated hardware elements.
An alternative technique consists in reusing the same hardware in **consecutive
time slots**, storing intermediate results as the algorithm is executed.

In a synchronous digital circuit, the elementary storage element is the
[D flip-flop](https://en.wikipedia.org/wiki/Flip-flop_%28electronics%29#D_flip-flop).
It can store one bit of data, and updates its state every clock cycle.
The effect of a D flip-flop is to delay its input to the next clock edge.
A *register* is a group of D flip-flops that store a piece of data encoded
as a *binary word*.

In a sequential circuit, the outputs can no longer be computed from the
current values of the inputs.

A sequential circuit transforms a sequence of values into another sequence.
To model such a circuit in a purely functional language, we need to write
functions that operate on *sequence* objects rather than single values.
A naive implementation could use lists like in this example:

```racket
(define (gcd-step ra rb e a b)
  (cond [e         (values a b)]
        [(> ra rb) (values (- ra rb) rb)]
        [(> rb ra) (values ra (- rb ra))]
        [else      (values ra rb)]))

(define (gcd sig-e sig-a sig-b)
  (define-values (sig-ra sig-rb) (feedback gcd-step (0 0) sig-e sig-a sig-b))
  sig-ra)

(gcd '(#f #t  #f  #f #f #f #t  #f  #f  #f  #f   )
     '(0  143 0   0  0  0  680 0   0   0   0    )
     '(0  91  0   0  0  0  440 0   0   0   0    ))
;    '(0  0   143 52 52 13 13  680 240 240 40 40)
```

In this implementation of the GCD, I have introduced an additional *enable*
input (`e`) to notify the circuit that a new pair `(a, b)` is available.
Now, the arguments of `gcd` are lists of values `sig-e`, `sig-a` and `sig-b`,
and the result is a list of output values.
`feedback` is a macro that inserts a given combinational function
in a feedback loop with registers: in this example, it calls `gcd-step` repeatedly
and constructs lists of values for registers `ra` and `rb`, with 0 as their
initial value.

![Sequential implementation of the GCD](/assets/figures/digital-circuits-racket/gcd-seq.svg)

`feedback` is similar to [`foldl`](https://docs.racket-lang.org/reference/pairs.html?q=foldl#%28def._%28%28lib._racket%2Fprivate%2Flist..rkt%29._foldl%29%29),
but it returns a list of accumulated values like the Haskell function
[`scanl`](https://hackage.haskell.org/package/base-4.14.1.0/docs/Prelude.html#v:scanl).
Moreover, `feedback` accepts a list as the initial *seed* value, and supports
several other lists as inputs:

```racket
(define-simple-macro (feedback fn (val ...) sig ...)
  #:with (x ...) (generate-temporaries #'(sig ...))
  #:with (y ...) (generate-temporaries #'(val ...))
  #:with (r ...) (generate-temporaries #'(val ...))
  (for/fold ([r (list val)] ...
             #:result (values (reverse r) ...))
            ([x (in-list sig)] ...)
    (define-values (y ...) (fn (first r) ... x ...))
    (values (cons y r) ...)))
```

Using lists as a data structure for signals is not a general solution: when function `gcd`
is called, we need to provide complete lists of input values `sig-e`, `sig-a` and `sig-b`.
This works only because there is no feedback loop between `gcd` and its environment.

If we want to model circuits using functions, we need a better *signal* data
type to *connect* these functions as we would connect hardware components.

A detour via Haskell and Clash
==============================

[Clash](https://clash-lang.org/) is a functional hardware description language
implemented as an embedded DSL in Haskell.
In Clash, circuits are modeled as Haskell functions that operate on objects
of type `Signal` defined as follows:

```haskell
data Signal a =
    a :- (Signal a)
```

where

* `a` represents the data type of each sample of a signal;
* `:-` is the data constructor for signals.

The above definition means that a signal is constructed as a pair whose first
element is a sample value and whose second element is another signal.
Since the second operand of `:-` cannot be *null*, a signal always contains
an *infinite* number of samples.

:::warning
The exact definition of the `Signal` type in Clash includes the notion of
clock *domain*.
In this post, I will consider circuits that contain only one clock domain.
:::

In Haskell, infinite data structures and feedback loops are made possible by
the lazy evaluation strategy, where the value of an expression is only computed
when needed.
For instance, in Clash, a counter can be defined like this:

```haskell
counter = c where
    c = 0 :- (add1 c)

add1 (x :- xs) = (x + 1) :- (add1 xs)
```

which means that `counter` is a signal `c` where:

* the first sample is 0;
* the rest of the signal is the result of applying `add1` to `c`;
* `add1` is a function that adds 1 to each sample of a signal.

Let's define a function that returns the first `n` samples of a signal
as a list:

```haskell
-- Taking zero samples returns an empty list.
sampleN 0 _ = []
-- When n > 0, we extract the first sample x from the signal,
-- and we use sampleN recursively to get the next (n-1) samples.
sampleN n (x :- xs) = x : sampleN (n - 1) xs
```

Here is what happens when we take the first 4 samples of the `counter` signal:

```haskell
sampleN 4 counter
= sampleN 4 (0 :- (add1 counter))                             -- Substitute the definition of counter
= 0 : (sampleN 3  (add1 counter))                             -- Apply sampleN with n > 0
= 0 : (sampleN 3  (add1 (0 :- (add1 counter))))               -- Substitute the definition of counter
= 0 : (sampleN 3  (1 :- (add1 (add1 counter))))               -- Apply add1
= 0 : (1 : (sampleN 2   (add1 (add1 counter))))               -- Apply sampleN with n > 0
= 0 : (1 : (sampleN 2   (add1 (add1 (0 :- (add1 counter)))))) -- Substitute the definition of counter
= 0 : (1 : (sampleN 2   (add1 (1 :- (add1 (add1 counter)))))) -- Apply add1
= 0 : (1 : (sampleN 2   (2 :- (add1 (add1 (add1 counter)))))) -- Apply add1
= 0 : (1 : (2 : (sampleN 1    (add1 (add1 (add1 counter)))))) -- Apply sampleN with n > 0
= 0 : (1 : (2 : (sampleN 1    (add1 (add1 (add1 (0 :- (add1 counter)))))))) -- etc.
= 0 : (1 : (2 : (sampleN 1    (add1 (add1 (1 :- (add1 (add1 counter))))))))
= 0 : (1 : (2 : (sampleN 1    (add1 (2 :- (add1 (add1 (add1 counter))))))))
= 0 : (1 : (2 : (sampleN 1    (3 :- (add1 (add1 (add1 (add1 counter))))))))
= 0 : (1 : (2 : (3 : (sampleN 0     (add1 (add1 (add1 (add1 counter))))))))
= 0 : (1 : (2 : (3 : [])))
= [0, 1, 2, 3]
```

In Clash, the `Signal` type implements the `Functor` typeclass, so we can convert
any unary function `f` that operates on values into a function that operates on
signals.
We can use it to rewrite `add1` as follows:

```haskell
instance Functor Signal where
    fmap f (x :- xs) = (f x) :- (fmap f xs)

add1 = fmap (1+)
```

`Signal` also implements the `Applicative` typeclass.
It defines a function `pure` that can be used for creating *constant* signals.
It also defines an operator `<*>` that will seem a little strange if you are
not familiar with applicative functors.

In fact, the operands of `<*>` are two signals:
the left operand produces a sequence of functions,
and the right operand produces a sequence of values.
The result is a signal that produces the output of each function applied
to the value at the same position.

```haskell
instance Applicative Signal where
    pure x = s where s = x :- s
    (f :- fs) <*> (x :- xs) = (f x) :- (fs <*> xs)
```

`pure` and `<*>` provide a more general mechanism to make ordinary functions
operate on signals.
If a function `f` takes *N* arguments, we can apply it to *N* signals
by following this process:

1. Wrap `f` in a signal using `pure`.
2. Apply `<*>` *N* times, with each input signal as the right operand
   of each application.

For instance, adding the values of two signals can  be performed like this:

```haskell
pure (+) <*> xs <*> ys
```

Using this technique, we can implement the `Num` typeclass on signals,
comparison and boolean operators, and a `mux` function that will be the
equivalent of `if-then-else` for signals:

```haskell
liftA2 f xs ys    = pure f <*> xs <*> ys
liftA3 f xs ys zs = pure f <*> xs <*> ys <*> zs

instance Num a => Num (Signal a) where
    (+)         = liftA2 (+)
    (-)         = liftA2 (-)
    (*)         = liftA2 (*)
    abs         = fmap abs
    signum      = fmap signum
    fromInteger = pure . fromInteger
    negate      = fmap negate

(.==.) = liftA2 (==)
(.>.)  = liftA2 (>)
(.&&.) = liftA2 (&&)
(.||.) = liftA2 (||)
-- etc.

mux = liftA3 (\c x y -> if c then x else y)
```

Now we can create a cyclic counter like this:

```haskell
counterMod5 = c where
    c = 0 :- mux (c .==. 4) 0 (c + 1)

sampleN 11 counterMod5
--> [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0]
```

And finally, here is an implementation of the GCD:

```haskell
gcd' e a b = ra
    where
        ra = 0 :- (mux e a $ mux (ra .>. rb) (ra - rb) ra)
        rb = 0 :- (mux e b $ mux (rb .>. ra) (rb - ra) rb)
```

![Sequential implementation of the GCD in Clash](/assets/figures/digital-circuits-racket/gcd-clash.svg)

Clash provides other facilities for creating sequential functions that
follow the Medvedev, Moore, and Mealy structures.
Explaining them is out of the scope of this post.

Implementing signals in Racket
==============================

The concept of *signal*, as explained in this section, is very close
to the concept of *stream* [in Scheme (SRFI41)](https://srfi.schemers.org/srfi-41/srfi-41.html)
and [in Racket](https://docs.racket-lang.org/reference/streams.html).
The book [Structure And Interpretation of Computer Programs (SICP)](https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book.html)
also contains a
[section about streams](https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book-Z-H-24.html#%_sec_3.5).

> When I started writing an implementation of signals in Racket,
> my only source of inspiration was the Clash source code.
> I didn't know anything about promises and streams in Racket,
> and I hadn't read SICP.
>
> This section is mostly based on my implementation of signals from scratch.
> While writing this post, I have made several changes to align the terminology
> and the implementation with the literature.

Delayed evaluation
------------------

In Racket, lazy evaluation can be achieved using [promises](https://docs.racket-lang.org/reference/Delayed_Evaluation.html).
The [delay](https://docs.racket-lang.org/reference/Delayed_Evaluation.html?q=delay#%28form._%28%28lib._racket%2Fpromise..rkt%29._delay%29%29)
macro converts an expression into a promise,
and the [force](https://docs.racket-lang.org/reference/Delayed_Evaluation.html?q=delay#%28def._%28%28lib._racket%2Fpromise..rkt%29._force%29%29)
function evaluates that expression.
The result of the evaluation is cached, so that we can `force`
the same promise multiple times without the cost of reevaluating the expression.

Here is a proposed implementation of `delay` and `force` for signals.
Lazyness is achieved by wrapping the given body in a function.
The result is memoized in a variable `res`:

```racket
(define-simple-macro (signal-delay body ...)
  (let ([res #f])                    ; Will store the value of the promise.
    (λ ()
      (unless res                    ; If the promise has not been forced,
        (set! res (begin body ...))) ; compute its value and store it.
      res)))                         ; Return the stored value.

(define-simple-macro (signal-force promise)
  (promise))                         ; Call the λ created by signal-delay.
```

`signal-delay` would not work in a general-purpose implementation of promises.
In fact, if the delayed body returned `#f`, we would mistake it for a
promise that has never been forced and the memoization would not work.
As we will see later, in the implementation of signals, the delayed expressions
will always produce truthy values.

Signal representation
---------------------

A signal will be represented by a *promise* that produces a pair
`(val . sig)` where `val` is the first value and `sig` is a promise
that generates the rest of the signal:

```racket
(define-simple-macro (signal-cons val sig)
  (signal-delay (cons val sig)))

(define (signal-first sig)
  (car (signal-force sig))) ; Returns the left element of the pair.

(define (signal-rest sig)
  (cdr (signal-force sig))) ; Returns the right element of the pair.
```

Since the pair is wrapped in a promise, nothing is evaluated until the first
call to `signal-force`.

Signal conversion from and to lists
-----------------------------------

Like the Clash function `sampleN`, `signal-take` computes the first `n` samples
of a signal and returns them as a list.
It is named after the Racket list manipulation function
[take](https://docs.racket-lang.org/reference/pairs.html?q=take#%28def._%28%28lib._racket%2Flist..rkt%29._take%29%29).

```racket
(define (signal-take sig n)
  (if (positive? n)
    (cons                                       ; Make a list with:
      (signal-first sig)                        ; the value of the first sample,
      (signal-take (signal-rest sig) (sub1 n))) ; the next n-1 sample values.
    empty))                                     ; If n is zero or less, return an empty list.
```

Without any syntactic sugar, a constant signal can be written as a circular
definition like in the example below.
Remember that inside `signal-cons`, `sig1` is not evaluated,
so we don't need to worry about infinite recursion here:

```racket
(define sig1 (signal-cons 56 sig1)) ; The rest of sig1 is sig1 itself!

(signal-take sig1 5)
; '(56 56 56 56 56)
```

To create signals, two other constructs are introduced.
Function `list->signal` converts a list into a signal.
Macro `signal` is syntactic sugar to create signals from the list of its
arguments.

To convert a finite list into an infinite signal, `list->signal` maps the last
element of the list to a constant signal by creating a circular `signal-cons`
like in the previous example:

```racket
(define (list->signal lst)
  (define rst (rest lst))
  (define sig (signal-cons              ; Create a signal:
                (first lst)             ; with the first element of the list,
                (if (empty? rst)        ; and if there are no more samples,
                  sig                   ; cycle over the current signal,
                  (list->signal rst)))) ; else, create a signal with the rest of the list.
  sig)

(define-simple-macro (signal val ...)
  (list->signal (list val ...))) ; Pass the arguments as a list to list->signal.

(define sig2 (signal 10 20 30)) ; The value 30 will be replicated forever.

(signal-take sig2 5)
; '(10 20 30 30 30)
```

Operations on signals
---------------------

Like we did in Haskell with the `Functor` and `Applicative` typeclasses,
we want to *lift* ordinary functions into functions that operate on signals.
A general solution for an arbitrary function `f` consists in creating
a function `f^` that accepts any number of signals as arguments, and that returns
another signal constructed like this:

* Make a list with the first sample of each argument, and call `f` on them.
* Make a list with the rest of each argument and call `f^` on them.
* *Cons* the results of `f` and `f^` into a new signal.

```racket
(define (signal-lift f)
  (define (f^ . sig-lst)                      ; The lifted version of f takes any number of arguments.
    (signal-cons                              ; It will return a signal:
      (apply f  (map signal-first sig-lst))   ; with f applied to the first sample of each argument,
      (apply f^ (map signal-rest  sig-lst)))) ; and the lifted f applied to the rest of each argument.
  f^)
```

For instance, the addition operation for signals will be implemented
by lifting the `+` operator:

```racket
(define +^ (signal-lift +))
(define -^ (signal-lift -))

(define sig3 (+^ (signal 1 2 3) (signal 10 20 30) (signal 100 200 300)))

(signal-take sig3 5)
; '(111 222 333 333 333)
```

When the number of arguments is known, we can spare the calls to `apply`
and `map` by using the following macro:

```racket
(define-simple-macro (signal-lift* f arg ...)
  #:with (tmp ...) (generate-temporaries #'(arg ...)) ; Make a unique name for each argument.
  (letrec ([f^ (λ (tmp ...)                           ; The lifted version of f takes the given number of arguments.
                 (signal-cons                         ; It will return a signal:
                   (f  (signal-first tmp) ...)        ; with f applied to the first sample of each argument,
                   (f^ (signal-rest  tmp) ...)))])    ; and the lifted f applied to the rest of each argument.
    f^))
```

Using `generate-temporaries` is a little trick to avoid checking that `arg ...`
contains distinct symbols (see the next example).

I don't know whether choosing `signal-lift*` rather than `signal-lift`
is relevant in terms of performance,
but a benefit of the macro is that `f` does not need to be a function.
For instance, we can implement a version of the `if` form for signals:

```racket
(define if^ (signal-lift* if _ _ _))

(define sig4 (if^ (signal #t #f #t #f #t #t #f) (signal 1) (signal 0)))

(signal-take sig4 8)
; '(1 0 1 0 1 1 0 0)
```

Finally, we can use `signal-lift` and `signal-lift*` to implement
forms similar to `lambda`, `define` and `for/list`.

```racket
(define-syntax-parser signal-λ
  ; Lift a λ with the given list of arguments.
  [(signal-λ (sig:id ...) body ...)
   #'(signal-lift* (λ (sig ...) body ...) sig ...)]
  ; Lift a λ that accepts any number of arguments.
  [(signal-λ sig-lst:id body ...)
   #'(signal-lift (λ sig-lst body ...))])

(define-syntax-parser define-signal
  ; Define a variable that contains a signal.
  [(define-signal name val ...)
   #'(define name (signal val ...))]
  ; Define a function with the given list of arguments.
  [(define-signal (name sig:id ...) body ...)
   #'(define name (signal-λ (sig ...) body ...))]
  ; Define a function that accepts any number of arguments.
  [(define-signal (name . sig-lst:id) body ...)
   #'(define name (signal-λ sig-lst body ...))])

(define-simple-macro (for/signal ([var:id sig] ...) body ...)
  ; Create a lifted λ and apply it immediately to the given signals.
  ((signal-λ (var ...) body ...) sig ...))
```

The macro `define-signal` is a shorthand for `(define name (signal ...))`
or `(define name (signal-λ ...))`.
We can use it to define functions whose arguments and results are signals,
but whose body uses ordinary operations on values:

```racket
; Multiply and accumulate.
(define-signal (mac^ a b c)
  (+ a (* b c)))

; Compute the mean of the given signals.
(define-signal (mean^ . sig-lst)
  (/ (apply + sig-lst) (length sig-lst)))
```

The macro `for/signal` lifts its body and applies it to the given signals
immediately:

```racket
; Compute the mean of these two signals.
(define sig7 (for/signal ([a (signal 10 20 30)] [b (signal 40 5 100)])
               (/ (+ a b) 2))
```

Two circuit description styles
------------------------------

Now we can implement the GCD example as:

```racket
(define >^ (signal-lift* > _ _))

(define (gcd sig-e sig-a sig-b)
  (define sig-ra (signal-cons 0 (if^ sig-e
                                  sig-a
                                  (if^ (>^ sig-ra sig-rb)
                                    (-^ sig-ra sig-rb)
                                    sig-ra))))
  (define sig-rb (signal-cons 0 (if^ sig-e
                                  sig-b
                                  (if^ (>^ sig-rb sig-ra)
                                    (-^ sig-rb sig-ra)
                                    sig-rb))))
  sig-ra)

(signal-take (gcd (signal #f #t  #f  #f #f #f #t  #f  #f  #f  #f)
                  (signal 0  143 0   0  0  0  680 0   0   0   0)
                  (signal 0  91  0   0  0  0  440 0   0   0   0)) 12)
; '(0 0 143 52 52 13 13 680 240 240 40 40)
```

It is not always useful to decompose a complex circuit into basic operations
on signals like this.
In the above case, `gcd` manages several internal signals that are not
really interesting.
In this case, we can use the macro `for/signal` like this:

```racket
(define (gcd sig-e sig-a sig-b)
  (define sig-ra (signal-cons 0 (for/signal ([e sig-e] [a sig-a] [ra sig-ra] [rb sig-rb])
                                  (cond [e         a]
                                        [(> ra rb) (- ra rb)]
                                        [else      ra]))))
  (define sig-rb (signal-cons 0 (for/signal ([e sig-e] [b sig-b] [ra sig-ra] [rb sig-rb])
                                  (cond [e         b]
                                        [(> rb ra) (- rb ra)]
                                        [else      rb]))))
  sig-ra)
```

Registers and feedback loops
----------------------------

For readability, we can provide a `register` form with built-in support for
feedback loops:

```racket
(define-simple-macro (register q0 expr)
  (letrec ([this-reg (signal-cons q0 expr)]) this-reg))
```

These macros define three register variants with synchronous *reset* and *enable* inputs:

```racket
(define-simple-macro (register/r q0 sig-r sig-d)
  (register q0 (for/signal ([r sig-r] [d sig-d])
                 (if r q0 d))))

(define-simple-macro (register/e q0 sig-e sig-d)
  (register q0 (if^ sig-e sig-d this-reg)))

(define-simple-macro (register/re q0 sig-r sig-e sig-d)
  (register q0 (for/signal ([r sig-r] [e sig-e] [d sig-d] [q this-reg])
                 (cond [r    q0]
                       [e    d]
                       [else q]))))
```

A Medvedev-style state machine component can be implemented using this pattern:

```racket
(define (make-state-machine sig-cmd1 sig-cmd2)
  (register 'IDLE
    (for/signal ([st this-reg] [cmd1 sig-cmd1] [cmd2 sig-cmd2])
      (match st
        ['IDLE    (cond [cmd1 'RUNNING]               [else 'IDLE])]
        ['RUNNING (cond [cmd1 'IDLE] [cmd2 'PAUSED]   [else 'RUNNING])]
        ['PAUSED  (cond [cmd1 'IDLE] [cmd2 'RUNNING'] [else 'PAUSED])]))))
```

And here is an implementation of the GCD using only one `register` form
to generate a signal of lists:

```racket
(define first^ (signal-lift* first _))

(define (gcd sig-e sig-a sig-b)
  (first^ (register '(0 0)
            (for/signal ([e sig-e] [a sig-a] [b sig-b] [ra-rb this-reg])
              (match-define (list ra rb) ra-rb)
              (cond [e         (list a b)]
                    [(> ra rb) (list (- ra rb) rb)]
                    [(> rb ra) (list ra (- rb ra)
                    [else      ra-rb])])))))
```

Conclusion
==========

In the series [My first domain-specific language with Racket](/2020/11/08/my-first-domain-specific-language-with-racket/),
Tiny-HDL lacked a proper model of computation and runtime to be a convincing
hardware description language.
In this post, I have introduced a functional API for manipulating digital
signals in Racket, similar to what Clash offers in Haskell.

As a next step, we could use it to improve Tiny-HDL with proper support
for signals in the generated Racket code.
At the syntactic level, we could also add constructs for describing sequential
circuits.

Another approach could be to use this API directly, as an *embedded DSL* for
hardware description in Racket.
This is basically what I did in the examples that illustrate this post,
but it is not my preferred approach.
In fact, I tend to prefer an HDL where the supported syntax clearly maps
to hardware, compared to a general-purpose language with a hardware description
*layer*, where the synthesizable subset would be difficult to specify.

In a best-of-both-worlds scenario, I would use a Racket-based standalone DSL
to write synthesizable circuit descriptions,
and I would simulate them in a test environment written in Racket.
