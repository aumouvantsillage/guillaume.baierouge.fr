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

In this article, we will use the well-known [binary adder](https://en.wikipedia.org/wiki/Adder_(electronics)#Binary_adders)
circuit as an example.
We will build a one-bit *full adder* composed of two *half adders*.

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

* *Negation* of a boolean expression: `(not expr)`
* *Or*, applied to zero or more expressions (returns false with no operand): `(or expr ...)`
* *And*, applied to zero or more expressions (returns true with no operand): `(and expr ...)`
* *Exclusive or* between two expressions: `(xor expr expr)`

Boolean literals are supported with the same syntax as in Racket:
`#t` (true) and `#f` (false).

A complete example
------------------

Here is the complete description of a full adder using two half adders:

```
(entity half-adder ([input a] [input b] [output s] [output co]))

(architecture half-adder-arch half-adder
  (assign s  (xor a b))
  (assign co (and a b)))

(entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

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

Language implementation roadmap
===============================

Imagine that we want to *simulate* digital electronic circuits by *executing*
the corresponding Tiny-HDL source code on the Racket platform.
The sequence of steps that we need to achieve can be summarized as:

1. *Syntax analysis*: check a source file against the grammar of the language;
   generate an *abstract syntax tree (AST)*.
2. *Semantic checking*: explore and check the AST against a set of rules;
   add semantic information to the AST for the *code generation* step.
3. *Code generation*: emit an executable program for the target platform.
4. *Execution*.

Since Tiny-HDL's syntax is based on S-expressions, the *syntax analysis* step
will be provided by Racket.
The *code generation* step will emit Racket code that will be immediately
executed by the Racket interpreter.

In the following posts, we will follow the above steps in the reverse order:

1. *Execution*: we will manually write some Racket code that implements the
   full adder example, and we will let Racket execute it.
2. *Code generation*: based on the manually written code, we will
   develop a set of macros that convert a Tiny-HDL syntax tree into Racket code.
3. *Semantic checking* (name resolution): in this step, we will write a basic
   semantic checker that infers the links between named references and the
   corresponding AST nodes;
   the Tiny-HDL AST will be modified with information for the *code generation* step.
4. *Semantic checking* (design rule checks): the semantic checker will be
   completed with domain-specific rules to ensure that a Tiny-HDL source file
   represents a valid digital electronic circuit.
5. *Semantic checking* (modules): what if we want to split a circuit description
   into several source files? How do we share information between modules for the
   semantic checker?
6. *Syntax analysis*: finally, we will register Tiny-HDL as a language
   with an S-expression reader.
