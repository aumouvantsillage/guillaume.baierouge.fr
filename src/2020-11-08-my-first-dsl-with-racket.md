---
title: My first domain-specific language with Racket
author: Guillaume Savaton
lang: fr
date: 2020-11-08
update: 2020-11-08
draft: false
collection: posts
tags: Free Software, Domain-Specific Language, Racket
template: post.html
---

For many years, I have felt an attraction to languages from the Lisp family,
but I was held back by two concerns: my indecisiveness about which variant to learn,
and the lack of a personal project to implement with it.
Recently, I have started drafting the [Hardware Description Language (HDL)](https://en.wikipedia.org/wiki/Hardware_description_language)
of my dreams and I have decided to try [Racket](https://racket-lang.org/),
a [Scheme](https://en.wikipedia.org/wiki/Scheme_%28programming_language%29) variant
that is also advertised as a language-oriented programming language.

<!-- more -->

This article is about my first discovery of Racket through an experiment
to create a reasonably small, though not trivial, Domain-Specific Language (DSL).
This DSL is a very simple and limited hardware description language,
loosely inspired by VHDL and Verilog.
This is not my *dream* HDL yet, but hopefully this work will be a good
starting point for a more *serious* language implementation.

This article is also about my alternate feelings of excitement and frustration
with Racket.
As a long-time adept of the [Model-Driven Engineering (MDE)](https://en.wikipedia.org/wiki/Model-driven_engineering)
methodology, using frameworks such as [EMF (the Eclipse Modeling Framework)](https://www.eclipse.org/modeling/emf/)
and [Xtext](https://www.eclipse.org/Xtext/), I have found Racket unsettling.
Browsing the documentation and tutorials, it was difficult to find beginner-level
information about concerns such as: exploration of an *abstract syntax tree*,
name resolution, and semantic checking.

As a consequence, if you are looking for a definitive guide on language programming
with Racket, you will probably not find it here.
The goal of this article is to share the issues and the solutions that I have found,
and hopefully gather feedback from more experienced Racket users.

Tiny-HDL, a not-so-simple hardware description language
=======================================================

Tiny-HDL is a Hardware Description Language that provides a very small subset of
the concepts found in VHDL or Verilog.
Its syntax is based on [S-expressions](https://en.wikipedia.org/wiki/S-expression),
but it is not mandatory: in Racket you can specify a custom parser for your language,
and you can even use a parser generator such as [Brag](https://docs.racket-lang.org/brag/).

Like in VHDL, Tiny-HDL separates the interface and the implementation of a circuit
into an *entity* and an *architecture*.
An entity has `input` and `output` ports that transport boolean values:

```
(entity half-adder ([input a] [input b] [output s] [output co]))

(entity full-adder ([input a] [input b] [input ci] [output s] [output co]))
```

An architecture provides an implementation for a given entity:

```
(architecture half-adder-arch half-adder
    ...
)

(architecture full-adder-arch full-adder
    ...
)
```

The body of an architecture is composed of concurrent statements.
Two kinds of statements are supported:

* An instantiation statement creates an instance of a given architecture.
* An assignment statement assigns the result of an expression to an output port of the current architecture, or to an input port of an instance.

In this example, we create an instance `h1` of the architecture `half-adder-arch`.
Then we assign the port `a` of the current architecture to the port `a` of `h1`.

```
(architecture full-adder-arch full-adder
  (instance h1 half-adder-arch)
  ...
  (assign (h1 a) a)
)
```

In the right-hand side of an assignment, Tiny-HDL also supports boolean operations
using the following syntax:

* `(not expr)`
* `(xor expr expr)`
* `(or expr ...)`
* `(and expr ...)`

Boolean literals are supported with the same syntax as in Racket:
`#t` (true) and `#f` (false).

Example
-------

Here is the complete full-adder description using two instances of a half-adder entity:

```
(entity half-adder ([input a] [input b] [output s] [output co]))

(entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

(architecture half-adder-arch half-adder
  (assign s  (xor a b))
  (assign co (and a b)))

(architecture full-adder-arch full-adder
  (instance h1 half-adder-arch)
  (instance h2 half-adder-arch)
  (assign (h1 a) a)
  (assign (h1 b) b)
  (assign (h2 a) (h1 s))
  (assign (h2 b) ci)
  (assign s (h2 s))
  (assign co (or (h1 co) (h2 co))))
```

As you can see, Tiny-HDL is fairly limited: it has only one data type;
it does not support internal signal declarations; and it can only describe
combinational circuits.
However, the organization in entities, architectures and instances will provide
an interesting challenge for name resolution and semantic checking:
in the expression `(h1 a)`, how can we check that `a` exists as a port
for `h1`, and is a valid target for assignment?

Step 1: manual code generation
==============================
