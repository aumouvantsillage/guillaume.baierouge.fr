---
title: "My first domain-specific language with Racket. Step 2: Code generation"
lang: en
date: 2020-11-23
update: 2020-11-23
draft: false
collection: posts
tags: Free Software, Domain-Specific Language, Racket
template: post.html
---

In [step 1](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution),
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

In this landscape, [homoiconic](https://en.wikipedia.org/wiki/Homoiconicity)
languages provide a unique approach to compilation.
For instance, in languages from the Lisp family, the *intermediate representation*
of a Lisp program is composed of primitive Lisp data structures.
Having built-in support for manipulating code as data means that it is fairly
*easy* to write a Lisp program that transforms a Lisp program into another Lisp program.
As a consequence, we could use Lisp to write a compiler that translates a custom
variant of Lisp into *executable* Lisp code.

The code generator for Tiny-HDL will follow the same philosophy:

* It will be written in Racket.
* The *intermediate representation* of Tiny-HDL source code will be composed of
  [syntax objects](https://docs.racket-lang.org/guide/stx-obj.html),
  a built-in Racket data structure for S-expressions.
* It will emit *executable* Racket code that follows the guidelines from
  [step 1](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution).

Standalone, embedded, and hosted DSLs
=====================================

Before discovering Racket, I was familiar with the concepts of *external*
(or *standalone*) and *internal* (or *embedded*) domain-specific languages.

To summarize, an *embedded* DSL is built on top of another programming language.
While it uses the syntax and the compilation infrastructure of the
underlying language (totally or partially), the domain-specific aspects
can be provided in the form of libraries and syntactic patterns.
A great example is [Clash](https://clash-lang.org/), a hardware description language
built on Haskell.

On the opposite side, a *standalone* DSL has its own syntax, semantics,
and compilation infrastructure.
It can borrow part of its concepts and syntax from another language,
but it generally adds custom elements that make it incompatible with the original.
VHDL is an example of such a DSL: it takes inspiration from a subset of the
Ada programming language, but most of its syntax and semantics are specific to
the digital hardware domain.

As a third way, Racket developers promote the concept of *hosted* DSL.
If my understanding is correct, a *hosted* DSL is an extension of
a *host* language with custom syntax.
The custom syntactic forms are meant to be translated into the host language
at compile time.
In languages that support them, the translation rules can be specified
using *procedural macros*.

In this project, Tiny-HDL is clearly intended as a *standalone* language.
However, I think that it will be easier to understand the
process of implementing this language in Racket if we work on a *hosted*
version first.

Code generation using macros
============================

Getting and running the complete example
========================================

The source code for this step can be found in [branch step-02](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-02)
of the git repository for this project.
You will find the following new files:

* [main.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/main.rkt):
  the main module of the Tiny-HDL package.
* [lib/expander.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/lib/expander.rkt):
  the code generator module.
* [examples/full-adder-step-02.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/examples/full-adder-step-02.rkt):
  the full adder example written with macros in Racket.
* [examples/full-adder-step-02-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-01/examples/full-adder-step-01-test.rkt):
  the main test program for this step.

Getting the source code for step 2
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-02`:

```
git checkout step-02
```

Running the example
-------------------

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
