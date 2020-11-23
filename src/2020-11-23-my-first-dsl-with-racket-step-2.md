---
title: "My first domain-specific language with Racket. Step 2: Code generation"
lang: en
date: 2020-11-23
update: 2020-11-23
draft: false
collection: posts
tags: Free Software, Domain-Specific Language, Racket
template: post.html
---

In [step 1](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution),
I have written the full adder example in Racket, following a few mapping rules
to express the concepts of Tiny-HDL in Racket.
The next step consists in writing a code generator that implements these mapping rules
so that we can generate Racket code automatically.

<!-- more -->

Getting and running the complete example
========================================

The source code for this step can be found in [branch step-02](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-02)
of the git repository for this project.
You will find the following new files:

* [main.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/main.rkt):
  the main module of the Tiny-HDL package.
* [lib/expander.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/lib/expander.rkt):
  the code generator module.
* [examples/full-adder-step-02.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-02/examples/full-adder-step-02.rkt):
  the full adder example written with macros in Racket.
* [examples/full-adder-step-02-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-01/examples/full-adder-step-01-test.rkt):
  the main test program for this step.

Getting the source code for step 2
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-02`:

```
git checkout step-02
```

Running the example
-------------------

Run `full-adder-step-02-test.rkt` with Racket:

```
racket examples/full-adder-step-02-test.rkt
```

Hopefully, you will get the same result as in step 1:

```
 a  b ci     s co
#f #f #f -> #f #f
#f #f #t -> #t #f
#f #t #f -> #t #f
#f #t #t -> #f #t
#t #f #f -> #t #f
#t #f #t -> #f #t
#t #t #f -> #f #t
#t #t #t -> #t #t
```
