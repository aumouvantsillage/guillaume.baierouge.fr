---
title: "Gribouille: a demo hand-writing/drawing application for Firefox OS on the Flatfish tablet"
author: Guillaume Savaton
lang: en
date: 2014-08-08
updated: 2014-08-12
draft: false
collection:
- posts
- stories
tags: Mozilla, Tablet, Firefox OS
template: post.html
---

On the Nexus 7, I have always been surprised by the poor reactivity of
hand-writing and drawing applications.
Generally, there is a noticeable delay between the gestures of the finger (or stylus) and the
progess of the lines being drawn.
In some cases, it is difficult to draw small details rapidly: the resolution of the lines decreases
with the speed of the gestures.

I have created a simple demo application to test how the Flatfish tablet with Firefox OS behaves
and to experiment ideas to achieve an acceptable result.

<!-- more -->

Try the application by yourself
===============================

The demo application is called *Gribouille*, a French word that means writing or drawing carelessly,
scribbling, squiggling.
The source code [is available on a GitHub repository](https://github.com/aumouvantsillage/FxOS-Gribouille).
You can try it in the Firefox OS simulator or on a device using the
[Firefox OS App Manager](https://developer.mozilla.org/en-US/Firefox_OS/Using_the_App_Manager).
You can also [load it directly in a web browser](http://guillaume.baierouge.fr/apps/Gribouille).

How it works
============

The application reacts to touch and mouse events.
On a touch device, you can draw a path by touching the screen and moving your finger on the screen.
Raising your finger terminates the current path.
Touching the screen again starts a new path without removing the previous ones.

Technically, there are four objects that allow to record points and draw on the screen.
They can use two backends for drawing: SVG and canvas.

* ``Painter`` provides the common logic for installing event handlers and recording point coordinates.
  It defines an empty ``repaint`` method that must be overriden in objects that use a specific drawing backend.
  This object makes use of [animation frames](https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame)
  so that the ``repaint`` method is called only one time between successive repaints of the browser window.
* ``SVGPolylinePainter`` draws polylines on an SVG surface.
  It creates exactly one ``polyline`` element for each path drawn by the user.
  Each repaint updates the ``points`` attribute of the ``polyline`` element,
  appending the coordinates of the points that were added since the previous repaint.
* ``SVGPolylineGroupPainter``, like ``SVGPolylinePainter``, draws polylines on an SVG surface.
  Each repaint creates a new ``polyline`` element that contains only the points
  that were added since the previous repaint.
  The polylines that represent the same path are contained in a ``g`` element.
* ``CanvasPainter`` draws polylines on an canvas.
  Like ``SVGPolylineGroupPainter``, each repaint draws a sequence of straight lines
  that connect the points that were added since the previous repaint.

:::info
The painter can be selected from a drop-down list when lauching the application.
To retry with another painter, you must restart the application, or reload the
page if you are running it from a web browser.
:::

Results
=======

The application was run four times with a different painter object.
Since the path was hand-drawn each time, the collected data do not represent the
same path. For the same reason, the drawing speed and total duration may be different
in all four cases.

The application was run in the following conditions:
* As a packaged app in Firefox OS 2.1 on the Flatfish tablet.
* As a web page in Firefox 31 and Chrome 36 for Android 4.4.4 on a Nexus 7 (2012) tablet.

The pictures concern Firefox OS on the Flatfish.
They are reconstructed from the points collected by the application.
The red circles show the actual points that were recorded.

:::info
When a path has been drawn, the application prints a JSON object to the console
with all the collected data.
Copy-paste the JSON data to a text file and run ``node js/analyze.js filename.json``.
You will get a few messages with statistics, and two SVG files will be saved:
one with the reconstructed drawing and the other with a chart.
:::

Painter
-------

Remember that the ``Painter`` object does not draw anything on the screen.
As a result, the following picture shows an *ideal* situation where the
application only records input coordinates and no time is spent rendering
the paths.

<img src="/assets/figures/gribouille/Painter-FxOS-Flatfish.drawing.svg" width="75%">

On the following chart,
* The X axis corresponds to the time, in milliseconds.
* The vertical lines represent the time of the animation frames (1 line every 5 animation frames).
* The blue curve represents the cumulated distance from the beginning of the path.
* The orange curve represents the number of points since the beginning of the path.

This chart shows that when no repaint operation is performed, the touch events are
evenly distributed in time and the animation frames follow a regular rate.

<img src="/assets/figures/gribouille/Painter-FxOS-Flatfish.chart.svg" width="75%">

Both tested platforms show similar performance.
The maximum time between frames in Firefox for Android is due to an exceptionally
longer frame that happened during the execution for no identified reason.

| <!-- -->                                | Firefox OS, Flatfish | Firefox for Android, Nexus 7 | Chrome, Nexus7 |
|:----------------------------------------|:---------------------|:-----------------------------|:---------------|
| Segments                                | 394                  | 451                          | 408            |
| Time between animation frames (min)     | 4 ms                 | 4 ms                         | 1 ms           |
| Time between animation frames (average) | 17 ms                | 19 ms                        | 17 ms          |
| Time between animation frames (max)     | 45 ms                | 267 ms                       | 66 ms          |


SVGPolylinePainter
------------------

In the following picture, the path is drawn from left to right.
We can observe that the segments of the polyline become longer at the end.

<img src="/assets/figures/gribouille/SVGPolylinePainter-FxOS-Flatfish.drawing.svg" width="75%">

In the ``SVGPolylinePainter`` object, each execution of the ``repaint`` method assigns
a new value to the ``points`` attribute of the same ``polyline`` element.
Even if only one point was added, this forces the rendering engine to redraw the entire polyline.
As the polyline becomes longer, the rendering engine takes more and more time to draw it,
so that the application reacts more and more slowly.

This is visible in the following chart: the vertical lines show that the delay between animation
frames increases over time.
While the distance (blue curve) still progresses approximately linearly,
the orange curve shows that the application can handle fewer and fewer touch events.

<img src="/assets/figures/gribouille/SVGPolylinePainter-FxOS-Flatfish.chart.svg" width="75%">

The following table shows that Firefox OS and Firefox for Android behave differently in this
situation.
Firefox for Android renders the polyline more slowly, but does not miss touch events
(the number of segments is close to the ``Painter`` case).
For this reason, the resulting drawing is smoother but is also displayed with more latency.

| <!-- -->                                | Firefox OS, Flatfish | Firefox for Android, Nexus 7 | Chrome, Nexus7 |
|:----------------------------------------|:---------------------|:-----------------------------|:---------------|
| Segments                                | 210                  | 455                          | 352            |
| Time between animation frames (min)     | 1 ms                 | 13 ms                        | 11 ms          |
| Time between animation frames (average) | 50 ms                | 111 ms                       | 59 ms          |
| Time between animation frames (max)     | 117 ms               | 427 ms                       | 582 ms         |


SVGPolylineGroupPainter
-----------------------

To avoid redrawing the entire path each time a point is added, the ``SVGPolylineGroupPainter`` object
creates a new ``polyline`` element each time the ``repaint`` method is called.
The following picture shows no significant difference in smoothness between the beginning and the
end of the path.

<img src="/assets/figures/gribouille/SVGPolylineGroupPainter-FxOS-Flatfish.drawing.svg" width="75%">

In the following chart, we observe that the orange curve is nearly linear and that the animation frames
are distributed more evenly in time.

<img src="/assets/figures/gribouille/SVGPolylineGroupPainter-FxOS-Flatfish.chart.svg" width="75%">

In this case again, the average time between animation frames in Firefox OS is smaller
than in Firefox for Android and Chrome.
The application is slightly more pleasant to use in Firefox OS.

| <!-- -->                                | Firefox OS, Flatfish | Firefox for Android, Nexus 7 | Chrome, Nexus7 |
|:----------------------------------------|:---------------------|:-----------------------------|:---------------|
| Segments                                | 403                  | 428                          | 354            |
| Time between animation frames (min)     | 1 ms                 | 6 ms                         | 11 ms          |
| Time between animation frames (average) | 24 ms                | 59 ms                        | 48 ms          |
| Time between animation frames (max)     | 51 ms                | 284 ms                       | 444 ms         |


CanvasPainter
-------------

``CanvasPainter`` follows a similar strategy as ``SVGPolylineGroupPainter``, so we can expect
that the rendering will not slow down while the path grows.
But rendering on a ``canvas`` element gives a surprisingly bad result.

<img src="/assets/figures/gribouille/CanvasPainter-FxOS-Flatfish.drawing.svg" width="75%">

<img src="/assets/figures/gribouille/CanvasPainter-FxOS-Flatfish.chart.svg" width="75%">

Like Firefox OS, Firefox for Android takes a lot of time to render on a canvas.
But the number of segments shows that it still manages to create a smooth drawing.
In this case, Chrome gives the best result, very close to the *ideal* ``Painter`` case.

| <!-- -->                                | Firefox OS, Flatfish | Firefox for Android, Nexus 7 | Chrome, Nexus7 |
|:----------------------------------------|:---------------------|:-----------------------------|:---------------|
| Segments                                | 27                   | 461                          | 409            |
| Time between animation frames (min)     | 1 ms                 | 16 ms                        | 2 ms           |
| Time between animation frames (average) | 323 ms               | 192 ms                       | 19 ms          |
| Time between animation frames (max)     | 497 ms               | 447 ms                       | 97 ms          |


Preliminary conclusion
======================

Remember that this application was not designed as a benchmark, but rather as a demo that can help
highlight problems, propose solutions, and evaluate the progress made in optimizing Firefox OS on
the Flatfish.

Since this application mixes user events with image rendering, my interpretation of the results
may be totally wrong.
Also, since this experiment is not easily reproducible, maybe you will observe different results
and I will be glad to update my observations if it is appropriate.

I did not think that drawing lines could be so challenging for a web browser running on a tablet.
Making an acceptable drawing app with different kinds of brushes and effects seems out of reach
at present.
As an example, I find that [AntPaint](https://marketplace.firefox.com/app/antpaint)
is completely unusable on the Flatfish.

This small study raises a few questions:

* First of all, in both tested versions of Firefox, why is the canvas backend so bad compared to SVG?
  With the Chrome browser on the Nexus 7, canvas is the fastest backend!
* Can we make Firefox OS handle touch events during repaints, as Firefox for Android seems to do?
* Is it a hardware or software issue? I wish I could make comparisons with Firefox OS running on another device.
* Are there parameters that we can tune to benefit from hardware acceleration on the Flatfish?

I will post more on this topic as I get answers to these questions.
