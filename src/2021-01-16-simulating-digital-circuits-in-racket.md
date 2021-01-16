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

Let's define a function that returns the `n` first samples of a signal
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
Function `pure` can be used to create *constant* signals.
The operator `<*>` will seem a little strange at first.
Its operands are two signals: the left operand produces a sequence of functions
and the right operand produces a sequence of values.
The result is a signal that produces the output of each function applied to the
corresponding value.

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
2. Apply `<*>` *N* times.

For instance, adding the values of two signals can  be performed like this:

```haskell
pure (+) <*> xs <*> ys
```

This technique allows to implement the `Num` typeclass on signals,
comparison and boolean operators, and a `mux` function that will be the
equivalent of an `if` expression on signals:

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
```

Clash provides other facilities for creating sequential functions that
follow the Medvedev, Moore, and Mealy structures.

Implementing signals in Racket
==============================

> The concept of *signal*, as explained in this section, is very close
> to the concept of *stream* [in Scheme (SRFI41)](https://srfi.schemers.org/srfi-41/srfi-41.html)
> and [in Racket](https://docs.racket-lang.org/reference/streams.html).
> Scheme and Racket implement streams using promises while the following
> implementation of signals is based on plain lambdas with memoization.

Signal representation
---------------------
