---
title: "My first domain-specific language with Racket. Step 1: Execution"
lang: en
date: 2020-11-16
update: 2020-11-16
draft: false
collection: posts
tags: Domain-Specific Language, Racket
template: post.html
---

In [the previous post](/2020/11/08/my-first-domain-specific-language-with-racket),
I have sketched an informal specification of a small hardware description language
called Tiny-HDL.
Our goal is to *execute* circuit descriptions, written in Tiny-HDL, on the Racket
platform.
Which means that we need to implement a *compiler* from Tiny-HDL to Racket.

As explained in the proposed [language implementation roadmap](/2020/11/08/my-first-domain-specific-language-with-racket/#language-implementation-roadmap),
we will start in the *execution* step, with a hand-written Racket example program that
implements the Tiny-HDL concepts.

<!-- more -->

The two main building blocks provided by Tiny-HDL are entities and architectures.
An entity *declares* the ports of a family of circuits, and an architecture
*implements* a specific behavior.
With this distinction in mind, I have chosen to translate Tiny-HDL into the following
Racket constructs:

* An entity will be translated into a Racket structure type with one field per port.
* An architecture will be translated into a *constructor* function for the structure type of its entity.
* An instantiation will be translated into a call to an architecture's constructor.
* An assignment statement will be translated into a Racket statement that assigns an *expression* to a field of a structure instance.

Entities
========

Let's translate the `half-adder` entity into Racket code.
In Tiny-HDL, this entity looks like this:

```
(entity half-adder ([input a] [input b] [output s] [output co]))
```
In Racket, a basic structure type declaration could be:

```racket
(struct half-adder (a b s co))
```

As you can see, the `input` and `output` modes have disappeared in the translation.
Preserving this information would be useful if we planned to check assignment
errors at runtime.
However, in a language like Tiny-HDL, it might be a better idea to detect such errors
at compile time in a semantic checking stage.

Now, let us consider how the `half-adder` structure type will be used in the
context of the full adder example:

1. Architecture `half-adder-arch` will be translated into a constructor function that will
   create an instance of the `half-adder` structure type, and populate its fields
   `s` and `co`.
2. In architecture `full-adder-arch`, the constructor of `half-adder-arch`
   will be called twice to create instances `h1` and `h2`.
   The assignments to `(h1 a)`, `(h1 b)`, `(h2 a)`, and `(h2 b)` will set
   the fields `a` and `b` in `half-adder` structure instances.

In this example, we can see that some fields need to be set outside of the
function that instantiates a given structure type.
To make this possible in Racket, we will mark all fields `#:mutable`
(technically, only the *input* ports should be made mutable, but the translation
will be easier like this).
The `#:auto` modifier will also be added, so that all fields now have `#f`
(false) as their default value.

```racket
(struct half-adder ([a #:auto] [b #:auto] [s #:auto] [co #:auto]) #:mutable)
```

Architectures
=============

An architecture is translated into a function that returns an instance of
a structure type.
Here is the skeleton of the constructor for architecture `half-adder-arch`:

```racket
(define (half-adder-arch)
  (define self (half-adder))
  ...
  self)
```

Inside the body of an architecture, each Tiny-HDL statement will be translated
into a Racket statement:

Assignments and expressions
---------------------------

To read and write ports, we can call the accessors of the corresponding
structure fields.
Here is a naive translation of the body of architecture `half-adder-arch`:

```
(assign s  (xor a b))
(assign co (and a b)))
```

becomes:

```racket
; Warning: this does not work!
(set-half-adder-s!  self (xor (half-adder-a self) (half-adder-b self)))
(set-half-adder-co! self (and (half-adder-a self) (half-adder-b self)))
```

Remember that the function `half-adder-arch` is intended to be a *constructor*:
it must not compute the `xor` and `and` operations immediately.
Moreover, fields `a` and `b` are still empty.

We want to populate the fields `s` and `co` with expressions that will be
evaluated *later*.
To achieve that, we will wrap each expression in a *lambda* function like this:

```racket
(set-half-adder-s!  self (λ () (xor ((half-adder-a self)) ((half-adder-b self)))))
(set-half-adder-co! self (λ () (and ((half-adder-a self)) ((half-adder-b self)))))
```

Since fields `a` and `b` are supposed to contain *lambdas* as well, we also need an
additional pair of parentheses around each call to `half-adder-a` and `half-adder-b`.

> Note: if you find this code ugly, remember that our ultimate goal
> is to generate it automatically.
> As soon as the code generator is working, we will no longer need to look
> at the result.

Instantiation statements
------------------------

Architecture `full-adder-arch` creates two instances of `half-adder-arch`.

```
(instance h1 half-adder-arch)
(instance h2 half-adder-arch)
```

A straightforward translation consists in calling the constructor `half-adder-arch`
twice, assigning the results to variables like this:

```racket
(define h1 (half-adder-arch))
(define h2 (half-adder-arch))
```

Now that variables `h1` and `h2` are populated with instances of the `half-adder`
structure type, we can use the same techniques as above to read and write their ports:

```
(assign (h2 a) (h1 s))
```

becomes:

```racket
(set-half-adder-a! h2 (λ () ((half-adder-s h1))))
```

Getting and running the complete example
========================================

The complete implementation of Tiny-HDL is available on GitHub.
The git repository contains one branch per step.
In [branch step-01](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-01),
you will find the following files:

* [examples/full-adder-step-01.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-01/examples/full-adder-step-01.rkt):
  the hand-written full adder example in Racket.
* [examples/full-adder-common-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-01/examples/full-adder-common-test.rkt):
  a Racket program that executes the full adder and prints its truth table.
  This very same program will be used in steps 2 to 6, to check that our compiler works as expected.
* [examples/full-adder-step-01-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-01/examples/full-adder-step-01-test.rkt):
  the main test program for this step, using the two files mentioned above.

Getting the source code for step 1
----------------------------------

Clone the git repository and switch to branch `step-01`:

```
git clone https://github.com/aumouvantsillage/Tiny-HDL-Racket.git
cd Tiny-HDL-Racket
git checkout step-01
```

Running the example
-------------------

Run `full-adder-step-01-test.rkt` with Racket:

```
racket examples/full-adder-step-01-test.rkt
```

The result should look like:

```
 a  b ci     s co
#f #f #f -> #f #f
#f #f #t -> #t #f
#f #t #f -> #t #f
#f #t #t -> #f #t
#t #f #f -> #t #f
#t #f #t -> #f #t
#t #t #f -> #f #t
#t #t #t -> #t #t
```

Now that we know how to describe and simulate digital circuits with Racket,
let's implement a code generator.
