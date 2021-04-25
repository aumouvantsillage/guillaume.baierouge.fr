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

| Signal    | Direction | Size (bits) | Role                                                              |
|:----------|:----------|------------:|:------------------------------------------------------------------|
| `reset`   | Input     |           1 | Forces the processor to restart in its initial state.             |
| `valid`   | Output    |           1 | When asserted, the processor initiates a data transfer.           |
| `ready`   | Input     |           1 | Indicates that the device is ready for a new data transfer.       |
| `address` | Output    |          32 | The address where to read or write.                               |
| `wstrobe` | Output    |           4 | Write enables for each byte of `wdata`; 0000 for a read transfer. |
| `wdata`   | Output    |          32 | The data to write.                                                |
| `rdata`   | Input     |          32 | The data read from the device.                                    |
| `irq`     | Input     |           1 | Interrupt request.                                                |

The processor asserts its output `valid` to indicate that `address`, `wstrobe`
and `wdata` are all valid and stable.
If a device is mapped to the given address, it responds by assigning `rdata`
and asserting `ready`.
A data transfer is considered complete when `valid` and `ready` are both high
on the same clock edge.

In the following sections, I will detail the internal operation of the processor
and show the Racket code that implements it.
But before that, let's have a look at the Racket forms that we will need.

How to describe circuits in Racket
==================================
