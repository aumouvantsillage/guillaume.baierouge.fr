---
title: "Simulating digital circuits in Racket"
subtitle: "A RISC-V core in Racket"
author: Guillaume Savaton
lang: en
date: 2021-04-23
draft: false
collection: posts
tags: Racket, Digital electronics, RISC-V
layout: post.njk
---

Let's try to implement a non-trivial circuit in Racket using the techniques
proposed in [my previous post](/2021/03/14/simulating-digital-circuits-in-racket/index.html).

Virgule is a 32-bit RISC processor core that supports most of the
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
to avoid cluttering the block diagram.

Virgule uses a similar bus interface as the [PicoRV32](https://github.com/cliffordwolf/picorv32).
The same interface is used for fetching instructions and for load/store
operations.
Here is a description of Virgule's I/O ports:

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

Circuit implementation techniques and conventions
=================================================

My previous blog post, [Simulating digital circuits in Racket](/2021/03/14/simulating-digital-circuits-in-racket/index.html),
introduced several constructs to represent and manipulate hardware signals in
Racket.
This section explains the choices that I have made, and the syntactic sugar
that I have added when implementing Virgule.

Combinational components
------------------------

A combinational component can be written as a function.
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
(define-signal (load-store-unit #:instr instr #:address address
                                #:store-enable store-enable #:store-data store-data)
                                 #:rdata rdata
  #:returns (wstrobe wdata load-data)
  ...
  (define wstrobe   ...)
  (define wdata     ...)
  (define load-data ...))
```

Internally, `load-store-unit` will *bundle* `load-data`, `wstrobe` and `wdata`
into a *signal of lists*. When calling `load-store-unit`, this signal will be
*unbundled* into three separate signals:

```racket
(define-values (wstrobe wdata load-data)
  (load-store-unit #:instr        ...
                   #:address      ...
                   #:store-enable ...
                   #:store-data   ...
                   #:rdata        ...))
```

:::info
If you like to use *named associations* in your VHDL or Verilog instantiation
statements, you will appreciate the addition of *keyword arguments* to `define-signal`.
:::

Sequential components
---------------------

Sequential components such as `register-unit` or `branch-unit` are implemented
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

Referring to a signal that is defined later
-------------------------------------------

In a circuit that contains circular dependencies, a signal can appear in an
expression before it is assigned.
`signal-defer` is a macro that delays the evaluation of a Racket
variable containing a signal.
It could be defined like this:

```racket
(define-simple-macro (signal-defer sig)
  (signal-delay (signal-force sig)))
```

If I write:

```racket
(define x (signal-defer y))
```

the value of `y` will not be read until `x` is forced.
Forcing `x` will also automatically force `y`.

However, since we know that `signal-delay` creates a function, and
considering that we do not need an extra level of memoization, we
can replace it by a simple lambda:

```racket
(define-simple-macro (signal-defer sig)
  (λ ()
    (signal-force sig)))
```

Logic values and logic vectors
------------------------------

Hardware description languages usually have special support for binary
data types of arbitrary width. Before writing Virgule, my first impulse was to
create a Racket module that would provide data types and operations in the
spirit of VHDL packages `std_logic_1164` and `numeric_std`.

Such a module would be useful if my intent was to use Racket as a hardware
description language.
But you might remember that my ultimate goal is to use Racket as
a platform for a hardware description DSL.
While I expect this DSL to come with data types for logic vectors,
I am not convinced that we need sophisticated abstractions for these types
at runtime.

For this reason, the implementation of Virgule uses built-in Racket
types for logic values and logic vectors: booleans for flags and control signals,
integers for general-purpose data and numbers.
In fact, Racket integers already provide all the facilities that I need
to represent logic vectors at runtime:

* They can be arbitrarily large.
* They support all the [bitwise operations](https://docs.racket-lang.org/reference/generic-numbers.html?q=bitwise#%28part._.Bitwise_.Operations%29)
  needed for logic vectors.
* And obviously, they support integer arithmetic operations.

The missing features are: the ability to restrict the width of an integer,
sign extension of an integer with a given width, and vector concatenation.
For this reason, I have written the following helpers:

```racket
(unsigned-slice   v left right)
(signed-slice     v left right)
(unsigned         v width)
(signed           v width)
(unsigned-concat [v left right] ...)
(signed-concat   [v left right] ...)
```

* `unsigned-slice` and `signed-slice` take a slice of a vector `v`.
  `left` is the index of the most significant bit and `right` is the index of
  the least significant bit. `right` defaults to `left` if omitted.
  The *signed* version sign-extends the result starting from index `left`.
* `unsigned` and `signed` are shorthands to take a right-aligned slice of a given width.
* `unsigned-concat` and `signed-concat` are macros that concatenate slices from
  one or more logic vectors.
  `right` can be omitted like in `unsigned-slice` and `signed-slice`.

You can find the complete implementation of these functions and macros
in module [logic.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/logic.rkt).

:::info
There is no support for *uninitialized* or *indeterminate* binary values
(the `'U'` and `'X'` of the VHDL `std_logic` type).
:::

Virgule implementation walkthrough
==================================

There is a lot of Racket code in this section.
The biggest code snippets are collapsed so you are not obliged to scroll
through them if you are only interested in the explanations.

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
that stores the current state, a `match` expression that computes the next
state, and one combinational signal for each action.
I chose to represent states as symbols.
In VHDL, I would declare an enumerated type.

Click on the snippet to expand it.

:::collapse
```racket
(define (virgule #:reset reset #:rdata rdata #:ready ready #:irq irq)

  (define state-reg (register/r 'state-fetch reset
                      (for/signal (instr ready [state this-reg])
                        (match state
                          ['state-fetch     (if ready 'state-decode state)]
                          ['state-decode    'state-execute]
                          ['state-execute   (cond [(instruction-load?   instr) 'state-load]
                                                   [(instruction-store?  instr) 'state-store]
                                                   [(instruction-has-rd? instr) 'state-writeback]
                                                   [else                        'state-fetch])]
                          ['state-load      (if ready 'state-writeback state)]
                          ['state-store     (if ready 'state-fetch state)]
                          ['state-writeback 'state-fetch]))))

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

In the `fetch` state, the processor copies the program counter register
`pc-reg` to the address bus and asserts the `valid` output.
At the end of the memory transfer (`valid` and `ready`), the input data bus
`rdata` is copied to register `rdata-reg`.

![Fetching instructions](/figures/virgule-racket/virgule-fetch.svg)

This is the complete definition of signals `rdata-reg`, `valid` and `ready`.
In function `virgule`, they are part of the code that manages all memory
accesses.

```racket
(define rdata-reg (register/e 0 (signal-and valid ready) rdata))
(define valid     (signal-or fetch-en store-en load-en))
(define address   (signal-if fetch-en pc-reg alu-result-reg))
```

Decoding instructions
---------------------

The `decoder` function extracts information from the instruction word
in `rdata-reg`, producing the `instr` signal of type:

```racket
(struct instruction (rd funct3 rs1 rs2 imm
                     alu-fn use-pc? use-imm? has-rd?
                     load? store? jump? branch? mret?))
```

| Field      | Type           | Role                                                                              |
|:-----------|:---------------|:----------------------------------------------------------------------------------|
| `rd`       | 5-bit unsigned | The index of the destination register.                                            |
| `funct3`   | 3-bit unsigned | The `funct3` field of the instruction, encodes branch, load and store operations. |
| `rs1`      | 5-bit unsigned | The index of the first source register.                                           |
| `rs2`      | 5-bit unsigned | The index of the second source register.                                          |
| `imm`      | 32-bit signed  | The immediate value encoded in the instruction.                                   |
| `alu-fn`   | symbol         | The arithmetic or logic operation to execute.                                     |
| `use-pc?`  | boolean        | Does this instruction use the program counter as the first ALU operand?           |
| `use-imm?` | boolean        | Does this instruction use an immediate as the second ALU operand?                 |
| `has-rd?`  | boolean        | Does this instruction write a result to a destination register?                   |
| `load?`    | boolean        | Is this instruction a memory load?                                                |
| `store?`   | boolean        | Is this instruction a memory store?                                               |
| `jump?`    | boolean        | Is this instruction a jump (`JAL`, `JALR`)?                                       |
| `branch?`  | boolean        | Is this instruction a conditional branch?                                         |
| `mret?`    | boolean        | Is this instruction a return from an interrupt handler?                           |

![Decoding instructions](/figures/virgule-racket/virgule-decode.svg)

Several other operations happen in the `decode` state:

* `register-unit` reads the source registers needed by the instruction,
  and outputs their values to `xs1` and `xs2`.
* Two multiplexers select the operands for the arithmetic and logic unit.
  The first operand (`alu-a`) can be either the current value of the program
  counter (`pc-reg`) or `xs1`.
  The second operand (`alu-b`) can be either an immediate value or `xs2`.
* At the end of the clock cycle, `alu-a`, `alu-b`, `xs1`, `xs2` and `instr`
  are stored to registers.

:::collapse
```racket
(define instr (decoder (signal-defer rdata-reg)))
(define instr-reg (register/e instr-nop decode-en instr))

; Full version in section "Register writeback".
(define-values (xs1 xs2) (register-unit ...
                                        #:src-instr instr
                                        ...))

(define xs1-reg (register/e 0 decode-en xs1))
(define xs2-reg (register/e 0 decode-en xs2))

(define alu-a-reg (register/e 0 decode-en
                    (for/signal (instr xs1 [pc (signal-defer pc-reg)])
                      (if (instruction-use-pc? instr)
                        pc
                        xs1))))
(define alu-b-reg (register/e 0 decode-en
                    (for/signal (instr xs2)
                      (if (instruction-use-imm? instr)
                        (instruction-imm instr)
                        xs2))))
```
:::

`decoder` is defined in [datapath-components.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/datapath-components.rkt)
It uses constants and functions defined in module [opcodes.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/opcodes.rkt).

* `instruction-fmt` identifies the format of an instruction.
* `word->fields` extracts the fields from the instruction word.
* `decode-alu-fn` identifies the arithmetic or logic operation to execute.

:::collapse
```racket
(define (instruction-fmt opcode)
  (match opcode
    [(== opcode-op)                         'fmt-r]
    [(== opcode-store)                      'fmt-s]
    [(== opcode-branch)                     'fmt-b]
    [(or (== opcode-lui) (== opcode-auipc)) 'fmt-u]
    [(== opcode-jal)                        'fmt-j]
    [_                                      'fmt-i]))

(define (word->fields w)
  (define opcode (unsigned-slice w 6 0))
  (define imm (match (instruction-fmt opcode)
                ['fmt-i (signed-concat [w 31 20])]
                ['fmt-s (signed-concat [w 31 25] [w 11 7])]
                ['fmt-b (signed-concat [w 31] [w 7] [w 30 25] [w 11 8] [0 0])]
                ['fmt-u (signed-concat [w 31 12] [0 11 0])]
                ['fmt-j (signed-concat [w 31] [w 19 12] [w 20] [w 30 21] [0 0])]
                [_      0]))
  (values opcode
          (unsigned-slice w 11  7) ; rd
          (unsigned-slice w 14 12) ; funct3
          (unsigned-slice w 19 15) ; rs1
          (unsigned-slice w 24 20) ; rs2
          (unsigned-slice w 31 25) ; funct7
          imm))

(define (decode-alu-fn opcode funct3 funct7)
  (match (list     opcode                             funct3              funct7)
    [(list     (== opcode-lui)                        _                   _              ) 'alu-nop]
    [(list     (== opcode-op)                     (== funct3-add-sub) (== funct7-sub-sra)) 'alu-sub]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-slt)         _              ) 'alu-slt]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-sltu)        _              ) 'alu-sltu]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-xor)         _              ) 'alu-xor]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-or)          _              ) 'alu-or]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-and)         _              ) 'alu-and]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-sll)         _              ) 'alu-sll]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-srl-sra) (== funct7-sub-sra)) 'alu-sra]
    [(list (or (== opcode-op-imm) (== opcode-op)) (== funct3-srl-sra)     _              ) 'alu-srl]
    [_                                                                                     'alu-add]))

(define-signal (decoder data)
  (define-values (opcode rd funct3 rs1 rs2 funct7 imm)
    (word->fields data))
  (define use-pc?  (in? opcode (opcode-auipc opcode-jal opcode-branch)))
  (define use-imm? (not (= opcode opcode-op)))
  (define load?    (= opcode opcode-load))
  (define store?   (= opcode opcode-store))
  (define mret?    (and (= opcode opcode-system) (= funct3 funct3-mret) (= imm imm-mret)))
  (define jump?    (in? opcode (opcode-jal opcode-jalr)))
  (define branch?  (= opcode opcode-branch))
  (define has-rd?  (nor branch? store? (zero? rd)))
  (define alu-fn   (decode-alu-fn opcode funct3 funct7))
  (instruction rd funct3 rs1 rs2 imm
               alu-fn use-pc? use-imm? has-rd?
               load? store? jump? branch? mret?))
```
:::

Arithmetic and logic operations, branches
-----------------------------------------

In the `execute` state, `arith-logic-unit` performs an arithmetic or logic operation
and `branch-unit` computes the address of the next instruction.
The signal `pc+4` receives the address immediately after the current instruction.
It is stored in a register (`pc+4-reg`) for later use in the `writeback` state.

![Executing instructions](/figures/virgule-racket/virgule-execute.svg)

In branch and jump instructions, the target address is the result of an
addition performed by the arithmetic and logic unit.
If the instruction is a conditional branch, `branch-unit` will compare the
values of two source registers, available in `xs1-reg` and `xs2-reg`,
and decide whether the branch is taken or not.

`branch-unit` also handles interrupts. When `irq` is asserted,
and when the processor is not already serving an interrupt request,
it will:

* switch to a non-interruptible state,
* save the address of the next instruction to an internal register (`mepc-reg`),
* branch to the interrupt service routine at address 4.

If the current instruction is `mret`, `branch-unit` will:

* switch back to the interruptible state,
* branch to the address saved in `mepc-reg`.

:::collapse
```racket
(define alu-result     (arith-logic-unit instr-reg alu-a-reg alu-b-reg))
(define alu-result-reg (register/e 0 execute-en alu-result))

(define pc-reg (register/re 0 reset execute-en
                 (branch-unit #:reset   reset
                              #:enable  execute-en
                              #:irq     irq
                              #:instr   instr-reg
                              #:xs1     xs1-reg
                              #:xs2     xs2-reg
                              #:address alu-result
                              #:pc+4    (signal-defer pc+4))))
(define pc+4 (for/signal (pc-reg)
               (word (+ 4 pc-reg))))
(define pc+4-reg (register/e 0 execute-en pc+4))
```
:::

Functions `arith-logic-unit` and `branch-unit` are defined in module
[datapath-components.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/datapath-components.rkt).

:::collapse
```racket
(define-signal (arith-logic-unit instr a b)
  (define sa (signed-word a))
  (define sb (signed-word b))
  (define sh (unsigned-slice b 5 0))
  (word (match (instruction-alu-fn instr)
          ['alu-nop  b]
          ['alu-add  (+ a b)]
          ['alu-sub  (- a b)]
          ['alu-slt  (if (< sa sb) 1 0)]
          ['alu-sltu (if (< a  b)  1 0)]
          ['alu-xor  (bitwise-xor a b)]
          ['alu-or   (bitwise-ior a b)]
          ['alu-and  (bitwise-and a b)]
          ['alu-sll  (arithmetic-shift a     sh)]
          ['alu-srl  (arithmetic-shift a  (- sh))]
          ['alu-sra  (arithmetic-shift sa (- sh))])))

(define-signal (comparator instr a b)
  (define sa (signed-word a))
  (define sb (signed-word b))
  (match (instruction-funct3 instr)
    [(== funct3-beq)  (=      a  b)]
    [(== funct3-bne)  (not (= a  b))]
    [(== funct3-blt)  (<      sa sb)]
    [(== funct3-bge)  (>=     sa sb)]
    [(== funct3-bltu) (<      a  b)]
    [(== funct3-bgeu) (>=     a  b)]
    [_                #f]))

(define (branch-unit #:reset reset #:enable enable #:irq irq
                     #:instr instr #:xs1 xs1 #:xs2 xs2 #:address address #:pc+4 pc+4)
  (define taken (comparator instr xs1 xs2))
  (define pc-target (for/signal (instr [mepc (signal-defer mepc-reg)] address taken pc+4)
                      (define aligned-address (unsigned-concat [address 31 2] [0 1 0]))
                      (cond [(instruction-mret? instr)               mepc]
                            [(instruction-jump? instr)               aligned-address]
                            [(and (instruction-branch? instr) taken) aligned-address]
                            [else                                    pc+4])))
  (define irq-state-reg (register/re #f reset enable
                          (for/signal (instr irq [state this-reg])
                            (cond [(instruction-mret? instr) #f]
                                  [irq                       #t]
                                  [else                      state]))))
  (define accept-irq (signal-and-not irq irq-state-reg))
  (define mepc-reg (register/re 0 reset (signal-and enable accept-irq)
                     pc-target))
  (signal-if accept-irq
             (signal irq-addr)
             pc-target))
```
:::

Memory operations
-----------------

In load and store operations, the address is always the result of an
addition performed by the arithmetic and logic unit.
The `valid` output is asserted in the `load` and `store` states.
At the end of the memory transfer (`valid` and `ready`), the input data bus
`rdata` is copied to register `rdata-reg`.

![Memory transfers](/figures/virgule-racket/virgule-load-store.svg)

In the `store` state, the role of `load-store-unit` consists in copying
the data from `xs2-reg` to `wdata`, ensuring that it is properly aligned
with respect to the target address and data size.
`load-store-unit` also sets the `wstrobe` output.

:::collapse
```racket
(define rdata-reg (register/e 0 (signal-and valid ready) rdata))
(define valid     (signal-or fetch-en store-en load-en))
(define address   (signal-if fetch-en pc-reg alu-result-reg))

; Full version in section "Register writeback".
(define-values (wstrobe wdata ...)
  (load-store-unit #:instr        instr-reg
                   #:address      alu-result-reg
                   #:store-enable store-en
                   #:store-data   xs2-reg
                   ...))
```
:::

Here is the part of `load-store-unit` that handles store operations:

:::collapse
```racket
(define-signal (load-store-unit #:instr instr #:address address
                                #:store-enable store-enable #:store-data store-data
                                #:rdata rdata)
  #:returns (wstrobe wdata load-data)
  (define align         (unsigned-slice address 1 0))
  (define wdata (match (instruction-funct3 instr)
                  [(== funct3-lb-sb) (unsigned-concat [store-data  7 0] [store-data  7 0]
                                                      [store-data  7 0] [store-data  7 0])]
                  [(== funct3-lh-sh) (unsigned-concat [store-data 15 0] [store-data 15 0])]
                  [_                 store-data]))
  (define wstrobe (if store-enable
                    (match (instruction-funct3 instr)
                      [(or (== funct3-lb-sb) (== funct3-lbu)) (arithmetic-shift #b0001 align)]
                      [(or (== funct3-lh-sh) (== funct3-lhu)) (arithmetic-shift #b0011 align)]
                      [(== funct3-lw-sw)                      #b1111]
                      [_                                      #b0000])
                    #b0000))
  ...))
```
:::

Register writeback
------------------

Finally, in the `writeback` state, the processor stores the result of the
current instruction into a destination register.
The register index is available in the `rd` field of `instr-reg`.

* If the instruction is a load, the result is taken from `rdata-reg` via
  `load-store-unit`, ensuring that it is properly aligned and sign-extended.
* If the instruction is a jump, the destination register receives a return
  address (`pc+4-reg`).
* In other cases, the destination register receives the result from
  `arith-logic-unit` (`alu-result-reg`).

![Register writeback](/figures/virgule-racket/virgule-writeback.svg)

:::collapse
```racket
(define-values (xs1 xs2) (register-unit #:reset      reset
                                        #:enable     writeback-en
                                        #:src-instr  instr
                                        #:dest-instr instr-reg
                                        #:xd         (signal-defer xd)))

(define-values (wstrobe wdata load-data)
  (load-store-unit #:instr        instr-reg
                   #:address      alu-result-reg
                   #:store-enable store-en
                   #:store-data   xs2-reg
                   #:rdata        rdata-reg))

(define xd (for/signal (instr-reg load-data pc+4-reg alu-result-reg)
             (cond [(instruction-load? instr-reg) load-data]
                   [(instruction-jump? instr-reg) pc+4-reg]
                   [else                          alu-result-reg])))
```
:::

Here is the code for `register-unit`. It uses a persistent vector
(`pvector`) to store register values. You will find an explanation of this
implementation choice in section [Performance considerations](#performance-considerations).

:::collapse
```racket
(define (register-unit #:reset reset #:enable enable
                       #:src-instr src-instr #:dest-instr dest-instr #:xd xd)
  (define x-reg (register/r (make-pvector reg-count 0) reset
                  (for/signal (enable dest-instr xd this-reg)
                    (if (and enable (instruction-has-rd? dest-instr))
                      (set-nth this-reg (instruction-rd dest-instr) xd)
                      this-reg))))
  (for/signal (src-instr x-reg) #:returns (xs1 xs2)
    (define xs1 (nth x-reg (instruction-rs1 src-instr)))
    (define xs2 (nth x-reg (instruction-rs2 src-instr)))))
```
:::

And this is the part of `load-store-unit` that handles load operations:

:::collapse
```racket
(define-signal (load-store-unit #:instr instr #:address address
                                #:store-enable store-enable #:store-data store-data
                                #:rdata rdata)
  #:returns (wstrobe wdata load-data)
  (define align         (unsigned-slice address 1 0))
  ...
  (define aligned-rdata (unsigned-slice rdata 31 (* 8 align)))
  (define load-data (word (match (instruction-funct3 instr)
                            [(== funct3-lb-sb) (signed-slice   aligned-rdata  7 0)]
                            [(== funct3-lh-sh) (signed-slice   aligned-rdata 15 0)]
                            [(== funct3-lbu)   (unsigned-slice aligned-rdata  7 0)]
                            [(== funct3-lhu)   (unsigned-slice aligned-rdata 15 0)]
                            [_                                 aligned-rdata]))))
```
:::


Simulating a computer system
============================

The repository contains several modules that can help simulate a system
with a processor core, memory and peripheral devices:

* [memory.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/memory.rkt)
  contains memory components.
* [device.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/device.rkt)
  helps define a memory map and the address decoding logic.
* [assembler.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/assembler.rkt)
  can convert an assembly program, written as S-expressions, into machine code.
* [vcd.rkt](https://github.com/aumouvantsillage/Virgule-CPU-Racket/blob/main/src/vcd.rkt)
  outputs waveforms to a [Value change dump](https://en.wikipedia.org/wiki/Value_change_dump)
  file that can be displayed by [GTKWave](http://gtkwave.sourceforge.net/).

Example programs for a simple system with a fake text output device are available
in the [examples](https://github.com/aumouvantsillage/Virgule-CPU-Racket/tree/main/examples)
folder.

Performance considerations
==========================

While implementing the register unit and the memory components, I had to choose
between two structures for the memory cells: they could be defined as a signal
of vectors, or as a vector of signals.

> In VHDL, such a choice does not exist: if I declare a signal with an
> array type, I am allowed to manipulate it as a whole,
> or I can reference each array element as if it were a separate signal.

In Racket, my first impression was that a signal of vectors would be less efficient
because each write operation would create a new vector.
But using a vector of signals turns out to be far worse, because the cost of reading
at any arbitrary location outweighs the benefits.

The [benchmarks](https://github.com/aumouvantsillage/Virgule-CPU-Racket/tree/main/benchmarks)
folder contains five programs that compare the speed an memory usage of various
memory implementations.
The following choices are compared:

* Using a signal of vectors *vs* a vector of signals.
* Using built-in Racket vectors *vs* [persistent vectors](https://docs.racket-lang.org/pvector/).
* Using `register/e` *vs* `register`.

The results show that the most efficient combination is to use a signal of
persistent vectors with `register`.
