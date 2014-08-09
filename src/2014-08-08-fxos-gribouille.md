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

<object data="/assets/figures/Painter.drawing.svg" type="image/svg+xml"
    width="75%"></object>

SVGPolylinePainter
------------------

In the following picture, the path is drawn from left to right.
We can observe that the segments of the polyline become longer at the end.

<object data="/assets/figures/SVGPolylinePainter.drawing.svg" type="image/svg+xml"
    width="75%"></object>

In the ``SVGPolylinePainter`` object, each execution of the ``repaint`` method assigns
a new value to the ``points`` attribute of the same ``polyline`` element.
Even if only one point was added, this forces the rendering engine to redraw the entire polyline.
As the polyline becomes longer, the rendering engine takes more and more time to draw it,
so that the application reacts more and more slowly.

SVGPolylineGroupPainter
-----------------------

To avoid redrawing the entire path each time a point is added, the ``SVGPolylineGroupPainter`` object
creates a new ``polyline`` element each time the ``repaint`` method is called.
The following picture shows no significant difference in smoothness between the beginning and the
end of the path.

<object data="/assets/figures/SVGPolylineGroupPainter.drawing.svg" type="image/svg+xml"
    width="75%"></object>

CanvasPainter
-------------

``CanvasPainter`` follows a similar strategy as ``SVGPolylineGroupPainter``, so we can expect
that the rendering will not slow down while the path grows.
But rendering on a ``canvas`` element gives a surprisingly bad result.

<object data="/assets/figures/CanvasPainter.drawing.svg" type="image/svg+xml"
    width="75%"></object>

