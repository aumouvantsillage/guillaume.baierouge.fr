---
title: "My first domain-specific language with Racket"
subtitle: "Step 2: Code generation"
author: Guillaume Savaton
lang: en
date: 2020-11-23
update: 2020-11-23
draft: false
collection: posts
tags: Domain-Specific Language, Racket
template: post.html
---

In [step 1](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution),
I have written the full adder example in Racket, following a few mapping rules
to express the concepts of the Tiny-HDL language.
The next step consists in writing a code generator that implements these mapping rules
so that we can generate Racket code automatically.

<!-- more -->

In a typical compiler, the code generator transforms an *intermediate representation*
of a program, such as an *abstract syntax tree* (AST), into an *executable form*.
The *intermediate representation* is a data structure
that results from the syntax and semantic analysis steps.
The *executable form* depends on the target execution platform:
it can be machine code for a processor,
bytecode for a virtual machine, or source code in an interpreted language.
In some cases, a code generator can be composed of several stages, involving
lower-level source code generation that is fed into another compiler.

Code generation from domain-specific languages
==============================================

Before discovering Racket, I was familiar with the concepts of *standalone*
(or *external*) and *embedded* (or *internal*) domain-specific languages.

An *embedded* DSL is built on top of another programming language.
It uses the syntax and the compilation infrastructure of the
underlying language, extending it with libraries and usage guidelines
to support domain-specific concepts.
As an example, [Clash](https://clash-lang.org/) is a hardware description
language built on Haskell: a valid circuit description in Clash is also a valid
Haskell program whose execution constitutes a *simulation* of the circuit.

On the opposite side, a *standalone* DSL has its own syntax and semantics,
and requires a specific compilation infrastructure.
VHDL and Verilog are examples of standalone DSLs for digital circuit development.
If you want to *simulate* a circuit described in one of these languages, you will
need a dedicated simulator or compiler, such as GHDL or Verilator.

As a third way, Racket developers promote the concept of *hosted* DSL.
If my understanding is correct, a *hosted* DSL extends a *host* language with
custom syntactic forms.
At compile time, these custom syntactic forms are translated into the host
language by executing rewriting rules.
When Racket is the host language, rewriting rules are typically specified
as *procedural macros* written in Racket itself.

> Each of these three types of DSLs handles code generation in a different way:
> an *embedded* DSL uses a pre-existing code generator for its underlying language;
> a *standalone* DSL needs a dedicated code generator written in another language;
> a *hosted* DSL specifies code generation rules that can be written as *macros*
> in the host language itself.

From Tiny-HDL to Racket using macros
====================================

In this project, Tiny-HDL is clearly intended as a *standalone* language.
However, since the syntax of Tiny-HDL is based on S-expressions,
implementing it as a *hosted* language in Racket felt more *natural* to me at first.
This is the approach that we will follow in steps 2 to 5.
As a consequence, in step 2, the full-adder example will look like this:

```racket
#lang racket

(require tiny-hdl)

(entity half-adder ([input a] [input b] [output s] [output co]))

(architecture half-adder-arch half-adder
  (assign (port-ref half-adder s)  (xor (port-ref half-adder a) (port-ref half-adder b)))
  (assign (port-ref half-adder co) (and (port-ref half-adder a) (port-ref half-adder b))))

...
```

You can notice the `#lang racket` directive that shows that this file is still
considered as Racket source code.
The `(require tiny-hdl)` form imports the macros provided by the `tiny-hdl` package,
so that the `entity`, `architecture`, and other Tiny-HDL forms are expanded into
Racket code.

Finally, you may have noticed the `port-ref` forms that were absent from
the language in the previous posts.
These will be explained in the following sections.

Entities
--------

Based on the [example from step 1](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution#entities),
we can write a Racket macro that generalizes the translation of an entity into a structure type:

```racket
(define-simple-macro (entity ent-name ([_ port-name] ...))
  (begin
    (provide (struct-out ent-name))
    (struct ent-name ([port-name #:auto] ...) #:mutable)))
```

The only new element here is the `provide` form that makes the structure type
available to other modules.

Architectures
-------------

Here again, a generalization of the [example from step 1](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution#architectures)
leads to this macro:

```racket
(define-simple-macro (architecture arch-name ent-name body ...)
  (begin
    (provide arch-name)
    (define (arch-name)
      (define self (ent-name))
      body ...
      self)))
```

> In the following sections, we will modify this macro
> slightly to provide additional information needed during the expansion of
> the architecture `body`.

Instances
---------

An [instantiation statement](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution#instantiation-statements)
expands to a variable that receives the result of a call to an architecture constructor:

```racket
(define-simple-macro (instance inst-name arch-name)
  (define inst-name (arch-name)))
```

Assignments and expressions
---------------------------

Boolean literals (`#t`, `#f`) are already valid Racket expressions
that won't need any specific treatment.
The same applies to boolean operations (`not`, `and`, `or`, `xor`)
after their operands have been expanded.

Reading and writing ports is not as straightforward.
Let's analyze an example from the architectures `half-adder-arch` and `full-adder-arch`:

```racket
(assign s (xor a b))
(assign (h2 a) (h1 s))
```

These statements should be translated into:

```racket
(set-half-adder-s! self (λ () (xor ((half-adder-a self)) ((half-adder-b self)))))
(set-half-adder-a! h2 (λ () ((half-adder-s h1))))
```

As you can see, the entity name `half-adder` is present in the generated code
but not in the source code.

In the first statement, since we are inside `half-adder-arch`, we could use
a [syntax parameter](https://docs.racket-lang.org/reference/stxparam.html)
to store the name of the current entity and make it
available in the expansion of the architecture body.
But this technique is not usable in the second statement because it
needs to retrieve the name of the entity from the architecture
of `h1` and `h2`.

In this step, I have chosen to make a *dumb* translator where each rewriting
rule operates only with the information immediately available.
For this reason, I introduce a `port-ref` form that associates the port name
with its entity name, along with an optional instance name.
The semantic checker, in the name resolution step, will be responsible for
creating these `port-ref` expressions.
In the code generation step, the two statements above will take the following form:

```racket
(assign (port-ref half-adder s) (xor (port-ref half-adder a) (port-ref half-adder b)))
(assign (port-ref half-adder a h2) (port-ref half-adder s h1))
```

The corresponding macros will use the function `format-id` to concatenate the
entity and port names into *setter* and *getter* function names.
The first argument of the setter and getter will depend on the presence or
absence of an instance name in the `port-ref` form.
If no instance name is present, it should use the `self` variable defined in
the current architecture constructor (but it will not work).

```racket
(define-simple-macro (assign ((~literal port-ref) ent-name port-name (~optional inst-name)) expr)
   #:with setter-name (format-id #'port-name "set-~a-~a!" #'ent-name #'port-name)
   #:with arg-name (if (attribute inst-name) #'inst-name #'self)
   (setter-name arg-name (λ () expr)))

(define-simple-macro (port-ref ent-name port-name (~optional inst-name))
   #:with getter-name (format-id #'port-name "~a-~a" #'ent-name #'port-name)
   #:with arg-name (if (attribute inst-name) #'inst-name #'self)
   ((getter-name arg-name)))
```

Working around macro hygiene
----------------------------

If you try to run the full adder example with the above macros, you will get
the following error message in macros `assign` and `port-ref`:

```
self: unbound identifier
```

The reason is that the symbol `self` introduced in the `architecture` macro
is bound to a compile-time lexical scope, to avoid conflicts with
other bindings of the same name at runtime.
As a consequence, in the code generated by macros `assign` and `port-ref`
the variable `self` is out of scope.

To fix this, we can use a [syntax parameter](https://docs.racket-lang.org/reference/stxparam.html)
and a [rename transformer](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._make-rename-transformer%29%29)
that will provide an *alias* of the `self` variable in the body of an architecture's
constructor.
Here are fixed versions of the `architecture`, `assign`, and `port-ref` macros:

```racket
(define-syntax-parameter current-instance
  (λ (stx)
    (raise-syntax-error (syntax-e stx) "can only be used inside an architecture")))

(define-simple-macro (architecture arch-name ent-name body ...)
  (begin
    (provide arch-name)
    (define (arch-name)
      (define self (ent-name))
      (syntax-parameterize ([current-instance (make-rename-transformer #'self)])
        body ...)
      self)))

(define-simple-macro (assign ((~literal port-ref) ent-name port-name (~optional inst-name)) expr)
  #:with setter-name (format-id #'port-name "set-~a-~a!" #'ent-name #'port-name)
  #:with arg-name (if (attribute inst-name) #'inst-name #'current-instance)
  (setter-name arg-name (λ () expr)))

(define-simple-macro (port-ref ent-name port-name (~optional inst-name))
  #:with getter-name (format-id #'port-name "~a-~a" #'ent-name #'port-name)
  #:with arg-name (if (attribute inst-name) #'inst-name #'current-instance)
  ((getter-name arg-name)))
```

Getting the source code and running the example
===============================================

The source code for this step can be found in [branch step-02](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-02)
of the git repository for this project.
You will find the following new files:

* [main.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/main.rkt):
  the main module of the Tiny-HDL package.
* [lib/expander.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/lib/expander.rkt):
  the code generator module.
* [examples/full-adder-step-02.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/examples/full-adder-step-02.rkt):
  the full adder example written with macros in Racket.
* [examples/full-adder-step-02-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/examples/full-adder-step-02-test.rkt):
  the main test program for this step.

Getting the source code for step 2
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-02`:

```
git checkout step-02
```

Running the example
-------------------

Register the current folder as a Racket *collection*:

```
raco link -n tiny-hdl .
```

Run `full-adder-step-02-test.rkt` with Racket:

```
racket examples/full-adder-step-02-test.rkt
```

Hopefully, you will get the same result as in step 1:

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
