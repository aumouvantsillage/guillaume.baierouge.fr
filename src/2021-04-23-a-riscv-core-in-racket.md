---
title: "Simulating digital circuits in Racket"
subtitle: "A RISC-V core in Racket"
author: Guillaume Savaton
lang: en
date: 2021-04-23
draft: false
collection:
- posts
- stories
tags: Racket, Digital electronics, RISC-V
layout: post.njk
---

Let's try to describe a non-trivial circuit in Racket using the techniques
proposed in [my previous post](/2021/03/14/simulating-digital-circuits-in-racket/index.html).

Virgule is a 32-bit RISC processor core that implements most of the
base instruction set of the RISC-V specification (RV32I).
It was initially designed and implemented in VHDL to serve as an illustration
for the digital electronics course that I teach.
The VHDL source code is not publicly available yet but you can get an overview
of what Virgule is by using [its web-based simulator emulsiV](https://guillaume-savaton-eseo.github.io/emulsiV)
and reading [its documentation](https://guillaume-savaton-eseo.github.io/emulsiV/doc).

<!-- more -->

I have written two implementations of Virgule: one uses a
finite state machine as a sequencer; the other is organized as a five-stage
pipeline.
Both implementations use the same set of components in their datapaths.

:::warning
The architecture of Virgule favours simplicity over completeness, speed or size.
If you are looking for an optimized, production-ready RISC-V core, there are
plenty of other implementations to choose from.
:::

Architecture
============

The pipelined version could be the topic of another post.
In this post, I will focus on the state-based implementation because it is
easier to understand.
Here is an overview of its internal architecture with a state diagram of its
sequencer:

![Architecture of the slow, state-based implementation](/figures/virgule-racket/virgule-state-based.svg)

Since the architecture is fully synchronous, the clock signal is not represented
to avoid cluttering the blok diagram.

Virgule uses a similar bus interface as the [PicoRV32](https://github.com/cliffordwolf/picorv32).
The same interface is used for fetching instructions, or for load and store
operations.
Here is a description of the I/O signals for Virgule:

| Signal    | Direction | Size (bits) | Role                                                                   |
|:----------|:----------|------------:|:-----------------------------------------------------------------------|
| `reset`   | Input     |           1 | Forces the processor to restart in its initial state.                  |
| `valid`   | Output    |           1 | When asserted, the processor initiates a data transfer.                |
| `ready`   | Input     |           1 | Indicates that the current responder is ready for a new data transfer. |
| `address` | Output    |          32 | The address where to read or write.                                    |
| `wstrobe` | Output    |           4 | Write enables for each byte of `wdata`; 0000 for a read transfer.      |
| `wdata`   | Output    |          32 | The data to write.                                                     |
| `rdata`   | Input     |          32 | The data read from the current responder.                              |
| `irq`     | Input     |           1 | Interrupt request.                                                     |

The processor asserts its output `valid` to indicate that `address`, `wstrobe`
and `wdata` are all valid and stable.
If a memory or peripheral device is mapped to the given address, it responds by
assigning `rdata` and asserting `ready`.
A data transfer is considered complete when `valid` and `ready` are both high
on the same clock edge.

In the following sections, I will detail the internal operation of the processor
and show the Racket code that implements it.
But before that, let's have a look at the Racket forms that we will need.

How to describe circuits in Racket
==================================

My previous blog post, [Simulating digital circuits in Racket](/2021/03/14/simulating-digital-circuits-in-racket/index.html),
introduced several constructs to represent and manipulate hardware signals in
Racket.
This section explains the choices that I have made, and the syntactic sugar
that I have added when implementing Virgule.

Combinational components
------------------------

A combinational component can be described by a function.
The form `define-signal` automatically *lifts* a Racket function that operates on
values into a function that operates on signals.
The instruction decoder and the arithmetic and logic unit are defined like this:

```racket
(define-signal (decoder data)
  ...
  instr)

(define-signal (arith-logic-unit instr a b)
  ...
  r)
```

In the previous blog post, my implementation of `define-signal` could only define
functions with a single output value.
It is an error to return `(values ...)` as the result of such a function.

In `decoder`, I work around this limitation by returning a struct value of type:

```racket
(struct instruction (...))
```

To address other situations, when creating a struct type is not relevant, I have
added a `#:returns` clause to `signal-λ`, `define-signal` and `for/signal`.
It is used in `load-store-unit` like this:

```racket
(define-signal (load-store-unit #:instr instr #:address address #:rdata rdata
                                #:store-enable store-enable #:store-data store-data)
  #:returns (load-data wstrobe wdata)
  ...
  (define load-data ...)
  (define wstrobe   ...)
  (define wdata     ...))
```

Internally, `load-store-unit` will *bundle* `load-data`, `wstrobe` and `wdata`
into a *signal of lists*. When calling `load-store-unit`, this signal will be
*unbundled* into three separate signals:

```racket
(define-values (load-data wstrobe wdata)
  (load-store-unit #:instr        ...
                   #:address      ...
                   #:rdata        ...
                   #:store-enable ...
                   #:store-data   ...))
```

:::info
If you like to use *named associations* in your VHDL or Verilog instantiation
statements, you will appreciate the addition of *keyword arguments* to `define-signal`.
:::

Sequential components
---------------------

Sequential components such as `register-unit` or `branch-unit` can be described
by ordinary functions using `define`.
As a consequence, if a component has several outputs, the corresponding Racket
function can use `(values ...)` to return the output signals.

In the function body, we can create sequential signals with `register`,
or any of its variants, and combinational signals with `for/signal`.

```racket
(define (register-unit #:reset reset #:enable enable
                       #:src-instr src-instr #:dest-instr dest-instr #:xd xd)
  (define x-reg (register/r ... reset
                  (for/signal (enable dest-instr xd this-reg)
                    ...)))
  (for/signal (src-instr x-reg) #:returns (xs1 xs2)
    (define xs1 ...)
    (define xs2 ...)))
```

To make the code easier to read, I have modified `for/signal` so that
the following forms are equivalent:

```racket
; This form:
(for/signal (src-instr x-reg) ...)
; ... is short for:
(for/signal ([src-instr src-instr] [x-reg x-reg]) ...)
```

Logic values and logic vectors
------------------------------

Hardware description languages usually have special support for binary
data types of arbitrary width. Before writing Virgule, my first impulse was to
create a Racket module that would provide data types and operations in the
spirit of VHDL packages `std_logic_1164` and `numeric_std`.

This would have been useful if my intent was to use Racket as a hardware
description language.
But you might remember that my ultimate goal is to use Racket as
a platform for a hardware description DSL.
While I expect this DSL to come with data types for logic vectors,
there is no need to provide sophisticated abstractions for these types
at runtime.

In the implementation of Virgule, I use native Racket booleans and integers
directly, together with a few functions to manipulate them as if they were
fixed-width binary data.
In fact, Racket integers already provide all the facilities that I need
to represent logic vectors at runtime:

* In Racket, integers can be arbitrarily large.
* Racket already provides all the [bitwise operations](https://docs.racket-lang.org/reference/generic-numbers.html?q=bitwise#%28part._.Bitwise_.Operations%29)
  needed for logic vectors.
* And obviously, integers already support integer arithmetic operations.

The missing features are: the ability to restrict the width of an integer,
sign extension of an integer with a given width, vector concatenation.
For this reason, I have written the following helpers:

These functions take a slice of a logic vector.
`left` is the index of the most significant bit and `right` is the index of
the least significant bit. `right` defaults to `left` if omitted.
The *signed* version sign-extends the result starting from index `left`.

```racket
(unsigned-slice v left right)
(signed-slice   v left right)
```

These are shorthands to take a right-aligned slice of a given width:

```racket
(unsigned v w)
(signed   v w)
```

These macros concatenate slices from one or more logic vectors.
`right` can be omitted like in `unsigned-slice` and `signed-slice`:

```racket
(unsigned-concat [v left right] ...)
(signed-concat   [v left right] ...)
```

You can find the complete implementation of these functions and macros
in module [logic.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/logic.rkt).

Virgule description walkthrough
===============================

Sequencer
---------

The sequencer is a Moore machine where each state activates a boolean command
signal (`fetch-en`, `decode-en`, etc).

In states `fetch`, `load` and `store`, the sequencer waits for a data transfer
to complete (`ready`).
In the `execute` state, the sequencer uses information from the current
decoded instruction (`load?`, `store?`, `has-rd?`) to decide where to go next.

![Virgule sequencer state machine](/figures/virgule-racket/virgule-sequencer.svg)

In Racket, the state machine is composed of a `register/r` form
that stores the current state, a `case` expression that computes the next
state, and one combinational signal for each action.
We choose to represent states as symbols.
In VHDL, we would define an enumerated type.

:::partial
```racket
(define (virgule #:reset reset #:rdata rdata #:ready ready #:irq irq)

  (define state-reg (register/r 'state-fetch reset
                      (for/signal (instr ready [state this-reg])
                        (case state
                          [(state-fetch)     (if ready 'state-decode state)]
                          [(state-decode)    'state-execute]
                          [(state-execute)   (cond [(instruction-load?   instr) 'state-load]
                                                   [(instruction-store?  instr) 'state-store]
                                                   [(instruction-has-rd? instr) 'state-writeback]
                                                   [else                        'state-fetch])]
                          [(state-load)      (if ready 'state-writeback state)]
                          [(state-store)     (if ready 'state-fetch state)]
                          [(state-writeback) 'state-fetch]))))

  (define (state-equal? sym)
    (for/signal (state-reg)
      (equal? state-reg sym)))

  (define fetch-en     (state-equal? 'state-fetch))
  (define decode-en    (state-equal? 'state-decode))
  (define execute-en   (state-equal? 'state-execute))
  (define load-en      (state-equal? 'state-load))
  (define store-en     (state-equal? 'state-store))
  (define writeback-en (state-equal? 'state-writeback))

  ...)
```
:::

Fetching instructions
---------------------

Decoding instructions
---------------------

Arithmetic and logic operations, branches
-----------------------------------------

Memory operations
-----------------

Register writeback
------------------
