---
title: Rendering music notation for the web with VexTab and Metalsmith
author: Guillaume Savaton
lang: en
date: 2014-11-17
draft: false
collection: posts
tags: Music, Metalsmith, VexTab
template: post.html
---

[VexTab](http://www.vexflow.com/vextab/) is a language and a tool to create sheet music.
It is based on [VexFlow](http://www.vexflow.com/), a music notation rendering library written
in JavaScript.
In this post, I present a plugin for [Metalsmith](http://www.metalsmith.io/) to insert
music notation in a static web site.

<!-- more -->

VexTab and VexFlow require a web browser to render music notation.
They are typically executed on the client side, but they can also be used offline
using a headless web browser such as [PhantomJS](http://phantomjs.org/).

`metalsmith-vextab` is a [Metalsmith](http://www.metalsmith.io/) plugin that allows to insert
VexTab music notation in your source files (HTML, Markdown, etc) between customizable delimiters.
During the build process, VexTab code blocks are processed and rendered as
[SVG](https://fr.wikipedia.org/wiki/Scalable_Vector_Graphics) using VexFlow.

You can see an example below:

```
<vextab>
tabstave notation=true tablature=false
notes C-D-E-F-G-A-B/4 C/5
</vextab>
```

<vextab>
tabstave notation=true tablature=false
notes C-D-E-F-G-A-B/4 C/5
</vextab>

The plugin is [published as an npm module](https://www.npmjs.org/package/metalsmith-vextab).
The source code is available [in a GitHub repository](https://github.com/senshu/metalsmith-vextab).

