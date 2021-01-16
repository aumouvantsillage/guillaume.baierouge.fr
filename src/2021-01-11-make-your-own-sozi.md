---
title: "Make your own Sozi"
author: Guillaume Savaton
lang: en
date: 2021-01-11
draft: true
collection:
- posts
- stories
tags: Sozi
template: post.html
katex: true
---

[Sozi](https://sozi.baierouge.fr/) is a free and open-source *zooming*
presentation tool that I develop in my spare time.
This post gives an overview of the basic concepts used in Sozi presentations
and explains the maths behind them.

<!-- more -->

The camera metaphor
===================

The base material of a Sozi presentation is a static document that you can
create with a vector drawing software such as [Inkscape](https://inkscape.org/).
You can consider this document as a territory that you want to explore,
seen from above.
When playing a presentation, you can imagine that a *camera*
flies over that territory, moving from one viewpoint to another

The Sozi presentation editor allows you to define a sequence of such *viewpoints*
(which we call *frames*).
Let's illustrate this with an example:

![North hemisphere map](/assets/figures/make-your-own-sozi/north-hemisphere.svg)

This map is based on the document [Arctic (orthographic projection) with national
borders](https://commons.wikimedia.org/w/index.php?curid=7275544)
by Heraldry (CC BY-SA 3.0).
It shows the North hemisphere seen from above the North pole.
I have drawn two rectangles that represent two viewpoints for the camera:
one located above Québec and the other above France.

:::info
Behind the scenes, the image above is stored as an SVG (Scalable Vector Graphics)
document.
It is basically a text file that *describes* the image in terms of
primitive geometrical shapes (rectangles, ellipses, paths, etc).
For instance, a rectangle can be described using this syntax:

```xml
<rect x="12" y="56" width="350" height="220" />
```

where `x` and `y` are the coordinates of the upper-left corner of the rectangle,
`width` is the length of the horizontal sides, and `height` is the length of
the vertical sides.
The default length unit is the pixel.
:::

Defining a camera viewpoint
===========================

In Sozi, a viewpoint is specified as a rectangular region with the following properties:

* The coordinates of its center ($$x_c$$, $$y_c$$).
* Its width and height ($$w$$, $$h$$).
* A rotation angle ($$\theta$$).

Here, the terms *width* and *height* have the following meaning:
when the rotation angle is 0, the width is the length of the horizontal sides,
and the height is the length of the vertical sides.

Let's start from the map of the North hemisphere.
I have measured the properties of the two rectangles for you:

![North hemisphere map (rectangle properties)](/assets/figures/make-your-own-sozi/north-hemisphere-rect-props.svg)

|            | Québec | France |
|:-----------|-------:|-------:|
| $$x_c$$    |    187 |    385 |
| $$y_c$$    |    135 |    166 |
| $$w$$      |     69 |     46 |
| $$h$$      |     76 |     33 |
| $$\theta$$ |   +37° |   -34° |

:::info
The SVG standard specifies a default coordinate system where the origin is the
top-left corner of the image. The orientation of the $$Y$$ axis is the opposite
of the usual mathematical convention.
For this reason, a clockwise rotation corresponds to a positive angle.
:::
