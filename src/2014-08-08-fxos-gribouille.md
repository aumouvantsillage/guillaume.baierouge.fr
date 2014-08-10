---
title: "Gribouille: a demo hand-writing/drawing application for Firefox OS on the Flatfish tablet"
author: Guillaume Savaton
lang: en
date: 2014-08-08
draft: false
collection: posts
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
The source code [is available on a GitHub repository](https://github.com/senshu/FxOS-Gribouille).
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

<div class="info">
    The painter can be selected from a drop-down list when lauching the application.
    To retry with another painter, you must restart the application, or reload the
    page if you are running it from a web browser.
</div>

Results
=======

The application was run four times with a different painter object.
Since the path was hand-drawn each time, the collected data do not represent the
same path. For the same reason, the drawing speed and total duration may be different
in all four cases.

The following pictures are reconstructed from the points collected by the application.
The red circles show the actual points that were recorded.

Painter
-------

Remember that the ``Painter`` object does not draw anything on the screen.
As a result, the following picture shows an *ideal* situation where the
application only records input coordinates and no time is spent rendering
the paths.

<img src="/assets/figures/Painter-FxOS-Flatfish.drawing.svg" width="75%">

On the following chart,
* The X axis corresponds to the time, in milliseconds.
* The vertical lines represent the time of the animation frames (1 line every 5 animation frames).
* The blue curve represents the cumulated distance from the beginning of the path.
* The orange curve represents the number of points since the beginning of the path.

This chart shows that when no repaint operation is performed, the touch events are
evenly distributed in time and the animation frames follow a regular rate.

<img src="/assets/figures/Painter-FxOS-Flatfish.chart.svg" width="75%">

<table>
    <tr><td>Segments</td><td>394</td></tr>
    <tr><td>Time between animation frames (min)</td><td>4 ms</td></tr>
    <tr><td>Time between animation frames (average)</td><td>17 ms</td></tr>
    <tr><td>Time between animation frames (max)</td><td>45 ms</td></tr>
</table>

SVGPolylinePainter
------------------

In the following picture, the path is drawn from left to right.
We can observe that the segments of the polyline become longer at the end.

<img src="/assets/figures/SVGPolylinePainter-FxOS-Flatfish.drawing.svg" width="75%">

In the ``SVGPolylinePainter`` object, each execution of the ``repaint`` method assigns
a new value to the ``points`` attribute of the same ``polyline`` element.
Even if only one point was added, this forces the rendering engine to redraw the entire polyline.
As the polyline becomes longer, the rendering engine takes more and more time to draw it,
so that the application reacts more and more slowly.

This is visible in the following chart: the vertical lines show that the delay between animation
frames increases over time.
While the distance (blue curve) still progresses approximately linearly,
the orange curve shows that the application can handle fewer and fewer touch events.

<img src="/assets/figures/SVGPolylinePainter-FxOS-Flatfish.chart.svg" width="75%">

<table>
    <tr><td>Segments</td><td>210</td></tr>
    <tr><td>Time between animation frames (min)</td><td>1 ms</td></tr>
    <tr><td>Time between animation frames (average)</td><td>50 ms</td></tr>
    <tr><td>Time between animation frames (max)</td><td>117 ms</td></tr>
</table>


SVGPolylineGroupPainter
-----------------------

To avoid redrawing the entire path each time a point is added, the ``SVGPolylineGroupPainter`` object
creates a new ``polyline`` element each time the ``repaint`` method is called.
The following picture shows no significant difference in smoothness between the beginning and the
end of the path.

<img src="/assets/figures/SVGPolylineGroupPainter-FxOS-Flatfish.drawing.svg" width="75%">

In the following chart, we observe that the orange curve is nearly linear and that the animation frames
are distributed more evenly in time.

<img src="/assets/figures/SVGPolylineGroupPainter-FxOS-Flatfish.chart.svg" width="75%">

<table>
    <tr><td>Segments</td><td>403</td></tr>
    <tr><td>Time between animation frames (min)</td><td>1 ms</td></tr>
    <tr><td>Time between animation frames (average)</td><td>24 ms</td></tr>
    <tr><td>Time between animation frames (max)</td><td>51 ms</td></tr>
</table>


CanvasPainter
-------------

``CanvasPainter`` follows a similar strategy as ``SVGPolylineGroupPainter``, so we can expect
that the rendering will not slow down while the path grows.
But rendering on a ``canvas`` element gives a surprisingly bad result.

<img src="/assets/figures/CanvasPainter-FxOS-Flatfish.drawing.svg" width="75%">

<img src="/assets/figures/CanvasPainter-FxOS-Flatfish.chart.svg" width="75%">

<table>
    <tr><td>Segments</td><td>27</td></tr>
    <tr><td>Time between animation frames (min)</td><td>1 ms</td></tr>
    <tr><td>Time between animation frames (average)</td><td>323 ms</td></tr>
    <tr><td>Time between animation frames (max)</td><td>497 ms</td></tr>
</table>

