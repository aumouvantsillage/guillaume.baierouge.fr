---
title: "My first domain-specific language with Racket. Step 5: Modules"
lang: en
date: 2020-12-30
update: 2020-12-30
draft: false
collection: posts
tags: Domain-Specific Language, Racket
template: post.html
---

Racket offers a sophisticated module system that allows modules to
cooperate at run time, but also at compile time.
In this post, we will see how we can take advantage of the module system
in the semantic checking step of a domain-specific language.

<!-- more -->

Current use of Racket modules in Tiny-HDL
=========================================

Tiny-HDL already uses the Racket module system in the expanded Racket code.
For each entity and each architecture, it generates a structure type and
a function that are *exported* using `provide` forms:

```racket
(define-simple-macro (entity ent-name ([_ port-name] ...))
  (begin
    (provide (struct-out ent-name))
    (struct ent-name ([port-name #:auto] ...) #:mutable)))

(define-simple-macro (architecture arch-name ent-name body ...)
  (begin
    (provide arch-name)
    (define (arch-name)
      (define self (ent-name))
      body ...
      self)))
```

The *exported* definitions can be *imported* by another module using a `require` form.
For instance, the test module for the full adder example in step 3 begins like this:

```racket
(require "full-adder-step-03.rkt")

(define fa (full-adder-arch))
...
```

Now, what if we want to split a circuit description into several modules?
For instance, we could create a module containing the entity `half-adder` and
the architecture `half-adder-arch`, and another module containing the entity
`full-adder` and the architecture `full-adder-arch`.
Using `require`, the Racket code generated from the full-adder module would
be able to use the types and functions defined in the half-adder module,
and it would run as expected:

```racket
; half-adder-step-05.rkt
(begin-tiny-hdl
  (entity half-adder ([input a] [input b] [output s] [output co]))

  (architecture half-adder-arch half-adder
    ...))


; full-adder-step-05.rkt
(begin-tiny-hdl
  (require "half-adder-step-05.rkt")

  (entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

  (architecture full-adder-arch full-adder
      (instance h1 half-adder-arch)
      (instance h2 half-adder-arch)
      ...))
```

But this is not enough: we also need our modules to cooperate in the semantic checking steps.
At the moment, the `checker` function creates compile-time data and bindings that are not exported.
As a consequence, in the example above, when checking the instances `h1` and `h2`,
no binding will be found for the architecture `half-adder-arch`.

Issues and solutions
====================

The `checker` function that we wrote in steps 3 and 4 creates bindings using
the `bind!` function, which is itself based on
[`syntax-local-bind-syntaxes`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._syntax-local-bind-syntaxes%29%29),
a function from the Racket library.

`syntax-local-bind-syntaxes` creates bindings within an *internal definition context*,
which is fine for local definitions inside a Tiny-HDL `architecture` form.
However, compile-time data for entities and architectures themselves need to
be attached to module-level bindings if we want to *export* them.

> While working on this step, I tried really hard to keep the structure
> of the `checker` function intact.
> Using the same `bind!` function for all bindings would have been really neat.
> These are the two directions that I followed:
>
> * Find a drop-in replacement for `syntax-local-bind-syntaxes`, but for creating bindings in a module context.
> * Find a technique to promote an *internal* binding into a module-level binding.
>
> As it turns out, neither approach gave any good practical results.
> My explorations led either to partially broken solutions, and to a working,
> but convoluted implementation that involved too much code duplication.
>
> As you will see below, a working solution in the spirit of Racket requires
> to treat module-level bindings separately.
> I just had to accept that and break my precious `checker` function into two
> parts.
>
> Many thanks to Michael Ballantyne for his explanations, and for showing me
> examples of his methodology to address this problem.


* Add a `use` form to Tiny-HDL that expands to `require`.
* Export compile-time data for entities and architectures as module-level bindings.
* Organize the expansion of `begin-tiny-hdl` into two passes, to make sure that
  module-level bindings are available in the semantic checking step.
