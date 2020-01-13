---
title: midi@3:14, home-made MIDI keyboard
author: Guillaume Savaton
lang: fr
date: 2020-01-12
update: 2020-01-12
draft: false
collection: posts
tags: Free Software, Free Hardware, Music
template: post.html
---

This article is the first of a series about the "midi@3:14" MIDI keyboard.
We will first have a look at the hardware, and in the following articles,
we will describe its firmware and additional software.

<!-- more -->

What is it?
===========

midi@3:14 is a home-made electronic keyboard prototype for playing music.
It has been designed with the following requirements:

* Small size, light weight.
* Uniform layout (see the [Jankó](https://en.wikipedia.org/wiki/Jank%C3%B3_keyboard)
  and the [Harmonic table](https://en.wikipedia.org/wiki/Harmonic_table_note_layout) layouts for references).
* Compatible with any computer hardware (PC, Raspberry Pi, &hellip;) and free software synthesizers.

As a result, midi@3:14 has the following characteristics:

* [Jankó](https://en.wikipedia.org/wiki/Jank%C3%B3_keyboard) layout with 3 rows of 14 keys.
* 5 potentiometers that can be used to change the volume, or any other control value supported by the MIDI standard.
* A USB-MIDI interface.

The figure below shows the basic key assignment. The orange "Fn" key is intended
to be used in combination with the other keys to activate alternate functions such
as choosing an instrument or changing the base pitch (more on that in the next articles).

![midi@3:14 keyboard layout](/assets/figures/midi314-layout.svg)

::: info
The name "midi@3:14" refers to the MIDI interface and the layout.
It may remind French readers of the expression "Chercher midi à quatorze heures",
which translates to "To seek noon at 2pm", and usually means "To complicate things needlessly".
:::

Hardware design
===============

The keyboard is designed as a switch matrix using the same techniques as
a typical mechanical computer keyboard.
The main components are:

* 42 switches from the Cherry MX family,
* 42 diodes to prevent the "ghosting" effect when playing chords,
* 5 potentiometers,
* A microcontroller module, the Arduino-compatible [SparkFun Pro Micro](https://www.sparkfun.com/products/12640),
* A custom printed circuit board (PCB).

::: info
For more explanations about making a matrix keyboard, see the article
[How to make a keyboard - The matrix](http://blog.komar.be/how-to-make-a-keyboard-the-matrix/)
by Michał Trybus.
:::

The following sections provide details about the PCB design using
the free software suite [KiCad](https://kicad-pcb.org/) version 5.

Schematic capture
-----------------

The *Pro Micro* module has 18 I/O pins, of which 9 are digital only, 4 are analog only,
and 5 can be either digital or analog.
A naive switch matrix layout would use one pin per row and one pin per column.
For a 3&times;14 keyboard, this would require 17 digital pins, i.e. more than
what the *Pro Micro* provides.

However, there is no obligation for the electrical wiring to mimic the actual spatial key layout.
In midi@3:14, a better solution was to design the circuit as if the keyboard had 6 rows and 7 columns.
This solution uses 13 digital pins, leaving 5 pins available as analog inputs.
As can be seen in the schematic below, the keyboard is logically split into two parts:
the left part is assigned to rows 1 to 3 of the switch matrix,
and the right part is assigned to rows 4 to 6.

![midi@3:14 keyboard schematic](/assets/figures/midi314-schematic.svg)

PCB layout
----------
