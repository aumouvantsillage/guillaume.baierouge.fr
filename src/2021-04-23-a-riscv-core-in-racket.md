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

<!-- more -->

Introducing Virgule
===================

Virgule is a 32-bit RISC processor core that implements most of the
base instruction set of the RISC-V specification (RV32I).
It was initially designed and implemented in VHDL to serve as an illustration
for the digital electronics course that I teach.
The VHDL source code is not publicly available yet but you can get an overview
of what Virgule is by using [its web-based simulator emulsiV](https://guillaume-savaton-eseo.github.io/emulsiV)
and reading [its documentation](https://guillaume-savaton-eseo.github.io/emulsiV/doc).

:::warning
The architecture of Virgule favours simplicity over completeness, speed or size.
If you are looking for an optimized, production-ready RISC-V core, there are
plenty of other implementations to choose from.
:::

I have written two implementations of Virgule: the *slow* implementation uses a
finite state machine as a sequencer; the *fast* one is organized as a five-stage
pipeline.
Both implementations use the same set of components in their datapaths.

Architecture of the *slow* implementation
-----------------------------------------

Architecture of the *fast* implementation
-----------------------------------------
