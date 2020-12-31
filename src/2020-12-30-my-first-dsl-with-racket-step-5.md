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

Exporting entity and architecture definitions
=============================================

The `checker` function that we wrote in steps 3 and 4 creates bindings using
the `bind!` function, which is itself based on
[`syntax-local-bind-syntaxes`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._syntax-local-bind-syntaxes%29%29),
a function from the Racket library.
`syntax-local-bind-syntaxes` creates bindings within an *internal definition context*,
which is fine for local definitions inside a Tiny-HDL `architecture` body.
However, compile-time data for entities and architectures themselves need to
be attached to module-level bindings if we want to *export* them.

> While working on this step, I tried really hard to keep the structure
> of the `checker` function intact.
> Using the same `bind!` function for all bindings would have been really neat.
> Here are the two directions that I followed:
>
> * Find a drop-in replacement for `syntax-local-bind-syntaxes`, but for creating bindings in a module context.
> * Find a technique to promote an *internal* binding into a module-level binding.
>
> Neither approach actually gave any good practical results.
> My explorations led either to partially broken solutions, or to working,
> but convoluted implementations that involved too much code duplication.
> As you will see below, a working solution in the spirit of Racket requires
> to treat module-level bindings separately.
> I just had to accept that and break my precious `checker` function into two
> parts.
>
> Many thanks to Michael Ballantyne for his explanations, and for showing me
> examples of his methodology to address this problem.

The standard way to create a module-level binding is to generate a
[`define-syntax`](https://docs.racket-lang.org/reference/define.html?q=define-syntax#%28form._%28%28lib._racket%2Fprivate%2Fbase..rkt%29._define-syntax%29%29)
form in the expanded module.
This is a different process than using `syntax-local-bind-syntaxes`, where
bindings are created *dynamically* and can be accessed immediately.
The good news is that both kinds of bindings can be read using the function
[`syntax-local-value`](https://docs.racket-lang.org/reference/stxtrans.html?q=syntax-local-value#%28def._%28%28quote._~23~25kernel%29._syntax-local-value%29%29)
on which the `lookup` function is based.

So, for Tiny-HDL entities and architectures, the code responsible for constructing
and binding compile-time data must be moved to a macro that expands to `provide`
and `define-syntax` forms like this:

```racket
(define-syntax-parser module-level-bind
  [(_ e:stx/entity)
   #'(begin
       (provide e.name)
       (define-syntax e.name (meta/make-entity
                               (for/hash ([p (in-list '(e.port ...))])
                                 (define/syntax-parse q:stx/port p)
                                 (values #'q.name (meta/port (syntax->datum #'q.mode)))))))]

  [(_ a:stx/architecture)
   #'(begin
       (provide a.name)
       (define-syntax a.name (meta/architecture #'a.ent-name)))]

  ...

  ; The fallback case expands to a neutral form.
  [_ #'(begin)])

...

(define (checker stx)
  (syntax-parse stx
    ...

    [(begin-tiny-hdl body ...)
     ; We no longer need to create a scope here.
     (define body^ (map checker (attribute body)))
     (thunk
       ...)]

    [e:stx/entity
     ; Deleted. See macro module-level-bind.
     ; (bind! #'e.name (meta/make-entity ...))
     (thunk stx)]

    [a:stx/architecture
     ; Deleted. See macro module-level-bind.
     ; (bind! #'a.name (meta/architecture ...))
     (define body^ (with-scope
                     (~>> (attribute a.body)
                          (map add-scope)
                          (map checker))))
     (thunk/in-scope
       ...)]
    ...))
```

This implementation solves the problem of exporting bindings to *other* modules,
but will these bindings still be available for the semantic checker when
processing the *current* module?
We need to make sure that macro `module-level-bind` is expanded *before*
executing any `lookup`.
To achieve that, we will reorganize the `begin-tiny-hdl` macro in two passes:

1. Expand the macro `module-level-bind` for each form inside `begin-tiny-hdl`.
2. Expand the macro `check` that will call the semantic checker.

```racket
(define-syntax-parser begin-tiny-hdl
  [(_ body ...)
   #'(begin
       (module-level-bind body) ...
       (check body ...))])

(define-syntax (check stx)
  ((checker stx)))

...

(define (checker stx)
  (syntax-parse stx
    #:literals [check]
    ...
    [(check body ...)
     (define body^ (map checker (attribute body)))
     (thunk
       ...)]
    ...))
```

Importing entity and architecture definitions
=============================================

Tiny-HDL will support a `use` form that expands to `require`.
Here is a syntax class for this new form:

```racket
(define-syntax-class use
  #:literals [use]
  (pattern (use path:str)))
```

The `use` form must be expanded before calling the semantic checker.
A good place to do that is in the `module-level-bind` macro:

```racket
(define-syntax-parser module-level-bind
  [(_ e:stx/entity)
   #'(...)]

  [(_ a:stx/architecture)
   #'(...)]

  [(_ u:stx/use)
   #'(require u.path)]

  [_
   #'(begin)])
```

After being expanded, `use` forms are no longer needed.
The `checker` function will transform them into neutral `begin` forms:

```racket
(define (checker stx)
  (syntax-parse stx
    ...

    [:stx/use
     (thunk #'(begin))]

    ...))
```

Finally, we write a `use` macro that will raise an error if used in the wrong
context:

```racket
(define-syntax (use stx)
  (raise-syntax-error #f "should not be used outside of begin-tiny-hdl" stx))
```

Fixing name collisions
======================

TODO

Example
=======

The full adder example can now be split into two modules like this:

* A module containing the half adder entity and its architecture:

```racket
#lang racket

(require tiny-hdl)

(begin-tiny-hdl
  (entity half-adder ([input a] [input b] [output s] [output co]))

  (architecture half-adder-arch half-adder
    (assign s  (xor a b))
    (assign co (and a b))))
```

* A module containing the full adder entity and its architecture:

```racket
#lang racket

(require tiny-hdl)

(begin-tiny-hdl
  (use "half-adder-step-05.rkt")

  (entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

  (architecture full-adder-arch full-adder
    (instance h1 half-adder-arch)
    (instance h2 half-adder-arch)
    ...))
```

Getting the source code and running the examples
================================================

The source code for this step can be found in [branch step-05](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-05)
of the git repository for this project.

The full adder example is now split into two modules:

* [examples/half-adder-step-05.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-05/examples/half-adder-step-05.rkt):
  the entity `half-adder` and its architecture `half-adder-arch`.
* [examples/full-adder-step-05.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-05/examples/full-adder-step-05.rkt):
  the entity `full-adder` and its architecture `full-adder-arch`.

Getting the source code for step 5
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-05`:

```
git checkout step-05
```

Running the examples
--------------------

Run `full-adder-step-05-test.rkt` with Racket:

```
racket examples/full-adder-step-05-test.rkt
```
