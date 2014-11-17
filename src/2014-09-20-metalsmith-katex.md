---
title: Rendering math for the web with KaTeX and Metalsmith
author: Guillaume Savaton
lang: en
date: 2014-09-20
updated: 2014-11-17
draft: false
collection: posts
tags: Math, Metalsmith, KaTeX
template: post.html
---

I have recently discovered [KaTeX](https://khan.github.io/KaTeX/), a new
math typesetting library in JavaScript.
Rendering can be performed on the client, on the server, or offline.
Until today, there was no KaTeX plugin for [Metalsmith](http://www.metalsmith.io/)
publicly available. So I decided to write one.

<!-- more -->

``metalsmith-katex`` is a Metalsmith plugin that allows to insert TeX mathematical
formulas in your source files (HTML, Markdown, etc) between customizable delimiters.
During the build process, these formulas are extracted and converted to HTML by KaTeX.

You can see an example below:

```
<tex>
\displaystyle\sum_{k=0}^N k = \frac{N \times (N+1)}{2}
</tex>
```

<tex>
\displaystyle\sum_{k=0}^N k = \frac{N \times (N+1)}{2}
</tex>

The plugin is [published as an npm module](https://www.npmjs.org/package/metalsmith-katex).
The source code is available [in a GitHub repository](https://github.com/senshu/metalsmith-katex).
