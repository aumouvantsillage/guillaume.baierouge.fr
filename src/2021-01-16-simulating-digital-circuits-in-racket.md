---
title: "Simulating digital circuits in Racket"
author: Guillaume Savaton
lang: en
date: 2021-01-16
draft: false
collection:
- posts
- stories
tags: Racket, Digital electronics
template: post.html
---

In the series [My first domain-specific language with Racket](/2020/11/08/my-first-domain-specific-language-with-racket/),
I have created a simple hardware description language (HDL) called Tiny-HDL.
The intent of the series was to illustrate the techniques for creating a domain-specific
language in Racket, from parsing to code generation, with a focus on name resolution
and semantic checking.
In this post, I will focus on the runtime aspects: how can we *simulate* a digital
circuit description in Racket.

<!-- more -->

Functional description of digital circuits
==========================================

A detour via Haskell and Clash
===============================

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
sampleN 0 _ = []
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
(./=.) = liftA2 (/=)
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

Clash provides other facilities for creating sequential functions that
follow the Medvedev, Moore, and Mealy structures.
Explaining them is out of the scope of this article.

Implementing signals in Racket
==============================

The concept of *signal*, as explained in this section, is very close
to the concept of *stream* [in Scheme (SRFI41)](https://srfi.schemers.org/srfi-41/srfi-41.html)
and [in Racket](https://docs.racket-lang.org/reference/streams.html).
The book [Structure And Interpretation of Computer Programs (SICP)](https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book.html)
also contains a
[section about streams](https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book-Z-H-24.html#%_sec_3.5).

In this section, I re-implement a stream-like library from scratch,
with support for infinite streams only.

Delayed evaluation
------------------

In Racket, lazy evaluation can be achieved using [promises](https://docs.racket-lang.org/reference/Delayed_Evaluation.html).
The [delay](https://docs.racket-lang.org/reference/Delayed_Evaluation.html?q=delay#%28form._%28%28lib._racket%2Fpromise..rkt%29._delay%29%29)
converts an expression into a promise,
and the [force](https://docs.racket-lang.org/reference/Delayed_Evaluation.html?q=delay#%28def._%28%28lib._racket%2Fpromise..rkt%29._force%29%29)
function evaluate that expression when needed.
The result of the evaluation is cached, so that we can `force`
the same promise multiple times without the cost of reevaluating the expression.

Here is a proposed implementation of `delay` and `force` for signals.
Lazyness is achieved by wrapping the given body in a function.
The result is memoized in a variable `res`:

```racket
(define-simple-macro (signal-delay body ...)
  (let ([res #f])
    (λ ()
      (unless res
        (set! res (begin body ...)))
      res)))

(define-simple-macro (signal-force promise)
  (promise))
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
  (car (signal-force sig)))

(define (signal-rest sig)
  (cdr (signal-force sig)))
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
    (cons
      (signal-first sig)
      (signal-take (signal-rest sig) (sub1 n)))
    empty))
```

Without any syntactic sugar, a constant signal can be written as a circular
definition like in the example below.
Remember that inside `signal-cons`, `sig1` is not evaluated,
so we don't need to worry about infinite recursion here:

```racket
(define sig1 (signal-cons 56 sig1))

(signal-take sig1 5)
; '(56 56 56 56 56)
```

To create signals, two other constructs are introduced below.
Function `list->signal` converts a list into a signal.
Macro `signal` is syntactic sugar to create signals from a known
sequence of values.

To convert a finite list into an infinite signal, `list->signal` maps the last
element of the list to a constant signal by creating a circular `signal-cons`
like in the previous example:

```racket
(define (list->signal lst)
  (define rst (rest lst))
  (define sig (signal-cons
                (first lst)
                (if (empty? rst)
                  sig
                  (list->signal rst))))
  sig)

(define-simple-macro (signal val ...)
  (list->signal (list val ...)))

(define sig2 (signal 10 20 30))

(signal-take sig2 5)
; '(10 20 30 30 30)
```

Operations on signals
---------------------

Like we did in Haskell with the `Functor` and `Applicative` typeclasses,
we want to *lift* ordinary functions into functions that operate on signals.
A general solution for an arbitrary function `f` consists in creating
a function `g` that accepts any number of signals as arguments, and that returns
another signal constructed like this:

* Make a list with the first sample of each argument, and call `f` on them.
* Make a list with the rest of each argument and call `g` on them.
* *Cons* the results of `f` and `g` into a new signal.

```racket
(define (signal-lift f)
  (define (g . sig-lst)
    (signal-cons
      (apply f (map signal-first sig-lst))
      (apply g (map signal-rest  sig-lst))))
  g)
```

For instance, we can *lift* the `+` operator like this:

```racket
(define .+ (signal-lift +))

(define sig3 (.+ (signal 1 2 3) (signal 10 20 30) (signal 100 200 300)))

(signal-take sig3 5)
; '(111 222 333 333 333)
```

When the number of arguments is known, we can spare the calls to `apply`
and `map` by using the following macro:

```racket
(define-simple-macro (signal-lift* f arg ...)
  #:with (tmp ...) (generate-temporaries #'(arg ...))
  (letrec ([g (λ (tmp ...)
                (signal-cons
                  (f (signal-first tmp) ...)
                  (g (signal-rest  tmp) ...)))])
    g))
```

Using `generate-temporaries` is a little trick to avoid checking that `arg ...`
contains distinct symbols (see the example below).

I don't know whether choosing the macro is relevant in terms of performance,
but a benefit of `signal-lift*` is that `f` does not need to be a function.
For instance, we can implement a version of the `if` form for signals:

```racket
(define .if (signal-lift* if _ _ _))

(define sig4 (.if (signal #t #f #t #f #t #t #f) (signal 1) (signal 0)))

(signal-take sig4 8)
; '(1 0 1 0 1 1 0 0)
```

Finally, we can use `signal-lift` and `signal-lift*` to implement
forms similar to `lambda`, `define` and `let`.

```racket
(define-syntax-parser signal-λ
  [(signal-λ (sig:id ...) body ...)
   #'(signal-lift* (λ (sig ...) body ...) sig ...)]
  [(signal-λ sig-lst body ...)
   #'(signal-lift (λ sig-lst body ...))])

(define-syntax-parser define-signal
  [(define-signal (name sig:id ...) body ...)
   #'(define name (signal-λ (sig ...) body ...))]
  [(define-signal (name . sig-lst:id) body ...)
   #'(define name (signal-λ sig-lst body ...))])

(define-simple-macro (signal-let ([var:id sig] ...) body ...)
  ((signal-λ (var ...) body ...) sig ...))
```

The macro `define-signal` is a shorthand for `(define name (signal-λ ...))`.
We can use it to define functions whose arguments and results are signals,
but whose body uses ordinary operations on values:

```racket
(define-signal (.mac a b c)
  (+ a (* b c)))

(define-signal (.mean . sig-lst)
  (/ (apply + sig-lst) (length sig-lst)))
```

The macro `signal-let` lifts its body and applies it to the given signals
immediately:

```
(define sig7 (signal-let ([a (signal 10 20 30)] [b (signal 40 5 100)])
               (abs (- a b)))
```

Two circuit description styles
------------------------------

Now we can replicate the cyclic counter example as:

```racket
(define-signal (.= x y)
  (= x y))

(define-signal (.add1 x)
  (add1 x))

(define counter-mod-5
  (signal-cons
    0
    (.if (.= counter-mod-5 (signal 4))
      (signal 0)
      (.add1 counter-mod-5))))

(signal-take counter-mod-5 11)
; '(0 1 2 3 4 0 1 2 3 4 0)
```

It is not always useful to decompose a complex circuit into basic operations
on signals like this.
In the above case, the counter manages several internal signals that are not
really interesting.
Moreover, we need to be careful and wrap all constants in a `(signal ...)` form.

In this case, we can use `signal-let` like this:

```racket
(define counter-mod-5
  (signal-cons 0 (signal-let ([val counter-mod-5])
                   (if (= val 4)
                     0
                     (add1 val)))))
```

Registers and feedback loops
----------------------------

For readability, we can provide a `register` form as a synonym for `signal-cons`:

```racket
(define-simple-macro (register q0 d)
  (signal-cons q0 d))
```

A register with synchronous reset will assign `q0` to its output when
its `r` input is true:

```racket
(define-simple-macro (register/r q0 r d)
  (register q0 (signal-let ([r* r] [d* d])
                 (if r* q0 d*))))
```

To implement other digital hardware patterns, we will need a way to represent
feeback loops.
The `feedback` macro composes an expression `expr` with a register so that the
result of `expr` is the input of the register, and the output of the register
is fed back into the expression.

```racket
(define-simple-macro (feedback name q0 expr)
  (letrec ([name (register q0 expr)]) name))
```

These macros define two register variants with an *enable* input:

```racket
(define-simple-macro (register/e q0 e d)
  (feedback q q0 (.if e d q)))

(define-simple-macro (register/re q0 r e d)
  (feedback q q0 (signal-let ([r* r] [e* e] [d* d] [q* q])
                   (cond [r*   q0]
                         [e*   d*]
                         [else q*]))))
```
