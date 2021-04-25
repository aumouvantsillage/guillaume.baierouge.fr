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
| `rdata`   | Input     |          32 | The data read from the device.                                         |
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
This sections explains the main choices that I have made, and the syntactic sugar
that I have added when implementing Virgule.

Describing components
---------------------

A combinational component can be described by a function.
The form `define-signal` automatically *lifts* a Racket function that operates on
values into a function that operates on signals.
Based on the block diagram above, good candidates are:

```racket
(define-signal (decoder data)
  ...
  instr)

(define-signal (arith-logic-unit instr a b)
  ...
  r)
```

As defined in the previous blog post, `define-signal` can only handle functions
with a single output value.
Using `(values ...)` as the result of such a function will not work.

In `decoder`, we work around this limitation by returning a struct value of type:

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

:::info
If you like to use *named associations* in your VHDL or Verilog instantiation
statements, you will appreciate the addition of *keyword arguments* to `define-signal`.
:::

Internally, `load-store-unit` will create a signal of lists containing the values
of `load-data`, `wstrobe` and `wdata`. But the result of calling `load-store-unit`
will be three separate signals:

```racket
(define-values (load-data wstrobe wdata)
  (load-store-unit #:instr        ...
                   #:address      ...
                   #:rdata        ...
                   #:store-enable ...
                   #:store-data   ...))
```

Sequential components such as `register-unit` or `branch-unit` will be described
by plain functions.
Inside, we can create sequential signals with `register` and its variants,
and combinational signals with `for/signal`:

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
