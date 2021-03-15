---
title: "My first domain-specific language with Racket"
subtitle: "Step 6: Syntax analysis"
author: Guillaume Savaton
lang: en
date: 2021-01-05
draft: false
collection: posts
tags: Domain-Specific Language, Racket
layout: post.njk
---

This is the final step of my Racket DSL implementation roadmap.
It consists in promoting Tiny-HDL as a standalone language with two flavors:
a Lisp-like syntax and a custom syntax.

<!-- more -->

Two language flavors for Tiny-HDL
=================================

Since the beginning of this series, we have considered that the syntax
of Tiny-HDL was based on S-expressions.
This was natural and necessary because Tiny-HDL was only available as a Racket
library.
In step 6, we want to make Tiny-HDL a standalone language with two possible syntaxes:

* *Vanilla*, for parentheses lovers,
* *Spicy*, loosely inspired by VHDL and Verilog.

The *vanilla* description of the half adder and the full adder will look like this:

```racket
#lang tiny-hdl/vanilla

(entity half-adder ([input a] [input b] [output s] [output co]))

(architecture half-adder-arch half-adder
  (assign s  (xor a b))
  (assign co (and a b)))
```

```racket
#lang tiny-hdl/vanilla

(use "half-adder-step-06-vanilla.rkt")

(entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

(architecture full-adder-arch full-adder
  (instance h1 half-adder-arch)
  (instance h2 half-adder-arch)
  (assign (h1 a) a)
  (assign (h1 b) b)
  (assign (h2 a) (h1 s))
  (assign (h2 b) ci)
  (assign s      (h2 s))
  (assign co     (or (h1 co) (h2 co))))
```

Compared to the same example in step 5, the noticeable changes are:

* The `#lang racket` directives have been replaced by `#lang tiny-hdl/vanilla`.
* The `(require tiny-hdl)` forms have been removed.
* The Tiny-HDL code is no longer wrapped in `(begin-tiny-hdl ...)` forms.

And here is the *spicy* version of the same example:

```
#lang tiny-hdl/spicy

entity half-adder
    input a
    input b
    output s
    output co
end

architecture half-adder-arch of half-adder
  s  <= a xor b
  co <= a and b
end
```

```
#lang tiny-hdl/spicy

use "half-adder-step-06-spicy.rkt"

entity full-adder
  input a
  input b
  input ci
  output s
  output co
end

architecture full-adder-arch of full-adder
  h1 : half-adder-arch
  h2 : half-adder-arch
  h1.a <= a
  h1.b <= b
  h2.a <= h1.s
  h2.b <= ci
  s    <= h2.s
  co   <= h1.co or h2.co
end
```

In both cases, the `#lang` directive will have the following effect:

1. Racket will look up, and run, a *reader* for the chosen language flavor.
   A reader is basically a *parser* that converts source text into a
   syntax object.
2. The syntax object will come wrapped in a `#%module-begin` form that serves
   as a hook for macro expansion.
   Racket provides a default implementation of the `#%module-begin` macro, but
   we can provide our own to customize the expansion.

Implementing the *vanilla* flavor
=================================

Since Racket comes with a built-in S-expression parser, there is very little
work to do.
First, we create a module `vanilla/lang/reader.rkt` with the following content.

```racket
#lang s-exp syntax/module-reader
tiny-hdl/vanilla/lang/expander
```

This file specifies that Tiny-HDL will use the default Racket *reader*, and the
language implementation will be provided by the module `tiny-hdl/vanilla/lang/expander`.
You can read more about the [syntax/module-reader](https://docs.racket-lang.org/guide/syntax_module-reader.html)
language in the Racket guide.

In the module `vanilla/lang/expander.rkt`, we implement a custom `#%module-begin`
macro that wraps its body in a `begin-tiny-hdl` form.
This macro has been named `tiny-hdl-module-begin` internally because we need to
keep a reference to the original `#%module-begin` from Racket:

```racket
#lang racket

(require tiny-hdl)

(provide
  (all-from-out tiny-hdl)
  (rename-out [tiny-hdl-module-begin #%module-begin])
  xor and or not)

(define-syntax-rule (tiny-hdl-module-begin body ...)
  (#%module-begin
    (begin-tiny-hdl body ...)))
```

This module also provides the boolean operators from Racket as part of Tiny-HDL.

And that's it!
The *vanilla* flavor of Tiny-HDL is complete.

Implementing the *spicy* flavor
===============================

There are several techniques to write a custom *reader* with Racket.
You can either write a parser by hand, use one of the available
parsing libraries like [Megaparsack](https://docs.racket-lang.org/megaparsack/index.html?q=megaparsack),
or use a parser generator like [Brag](https://docs.racket-lang.org/brag/index.html?q=brag).

To implement the *spicy* flavor of Tiny-HDL, I have chosen to use Brag.

The reader module
-----------------

This time, the `spicy/lang/reader.rkt` module defines custom versions of
the [`read` and `read-syntax`](https://docs.racket-lang.org/reference/Reading.html#%28def._%28%28quote._~23~25kernel%29._read%29%29)
functions.

```racket
#lang s-exp syntax/module-reader
tiny-hdl/spicy/lang/expander
#:read                tiny-hdl-read
#:read-syntax         tiny-hdl-read-syntax
#:whole-body-readers? #t

(require "lexer.rkt" "grammar.rkt")

(define (tiny-hdl-read in)
  (syntax->datum (tiny-hdl-read-syntax #f in)))

(define (tiny-hdl-read-syntax src ip)
  (list (parse src (tokenize ip))))
```

As you can see, `tiny-hdl-read-syntax` uses two functions:

* `tokenize`, imported from `lexer.rkt`, converts a Tiny-HDL source file into a token stream.
* `parse`, imported from `grammar.rkt`, converts a token stream into a syntax object.

The lexical analyser
--------------------

The lexical analyzer (*lexer*, or *tokenizer*) is implemented in
`spicy/lang/lexer.rkt`.
It uses the [brag/support](https://docs.racket-lang.org/brag/index.html?q=brag%2Fsupport#%28mod-path._brag%2Fsupport%29)
module that provides facilities for creating lexers:

```racket
#lang racket

(require brag/support)

(provide tokenize)

(define (tokenize ip)
  (port-count-lines! ip)
  (define tiny-hdl-lexer
    (lexer-src-pos
      [(:or "use" "entity" "input" "output"
            "architecture" "of" "end"
            "and" "or" "not" "xor"
            "<=" ":" "." "(" ")")
       (token lexeme (string->symbol lexeme))]
      [(:or "false" "true")
       (token 'BOOLEAN (eq? lexeme "true"))]
      [(:seq alphabetic (:* (:or alphabetic numeric "_" "-")))
       (token 'ID (string->symbol lexeme))]
      [(from/to "\"" "\"")
       (token 'STRING (trim-ends "\"" lexeme "\""))]
      [whitespace
       (token 'WHITESPACE lexeme #:skip? #t)]
      [(eof)
       (void)]))
  (λ () (tiny-hdl-lexer ip)))
```

`tokenize` returns a function that reads an input port `ip` and returns
a new token each time it is called.
Tokens are generated by matching the character sequence from the input port
against regular expression patterns:

* A keyword, operator or punctuation mark (`use`, `entity`, ...) is converted into a symbol token.
* A boolean literal (`false`, `true`) is converted into a `BOOLEAN` token with a Racket boolean value (`#f`, `#t`).
* An identifier is converted into an `ID` token with a symbol value.
* A string literal is converted into a `STRING` token whose value is the string content.
* Whitespace is matched against a built-in `whitespace` pattern and converted into
  a `WHITESPACE` token that will be ignored.
* The *end-of-file* condition returns `(void)` as a termination indicator for the parser.

The parser
----------

The parser is specified as a grammar in `spicy/lang/grammar.rkt`
using the Brag language.
Interestingly, Brag itself is implemented as a Racket DSL with
a custom syntax.

The starting rule of the grammar is `begin-tiny-hdl`.
It defines a Tiny-HDL module as a sequence of *use* clauses, entities
and architectures:

```
#lang brag

begin-tiny-hdl: (use | entity | architecture)*
```

When this rule matches, the parser generates a syntax object with a root
form `begin-tiny-hdl` whose body is a sequence of syntax objects for `use`,
`entity`, and `architecture` forms.

A *use* clause is composed of the keyword `use` followed by a string literal.
The `/` character below means that the keyword `use` will be discarded from
the output to prevent a double `use` symbol in the result:

```
use: /"use" STRING
```

Similarly, we define the `entity` rule that generates an `entity` form.
All keywords are discarded from the result.
We define a separate rule `port-list` to force the port declarations
to be kept in a list inside the `entity` form.
However, we don't want the names `port-list` and `port` to be part of the result:

```
entity: /"entity" ID port-list /"end"

/port-list: port*

/port: ("input" | "output") ID
```

The `architecture` rule behaves a little differently.
In this case, we want the `instance` and `assign` forms to be direct children
of the `architecture` form.
For this reason, we do not define a separate `statement-list` rule,
and the `statement` rule is marked as *spliced* using the `@` indicator:

```
architecture: /"architecture" ID /"of" ID statement* /"end"

@statement: instance | assign

instance: ID /":" ID

assign: port-ref /"<=" expression
```

The following rules define the syntax of boolean expressions
and the operator precedence:

```
@expression: or | or-term

or:       (or-term /"or")+ or-term
@or-term: xor | xor-term

xor:       xor-term /"xor" xor-term
@xor-term: and | and-term

and:       (and-term /"and")+ and-term
@and-term: not | not-term

not: "not" not-term
@not-term: BOOLEAN
         | port-ref
         | /"(" expression /")"

@port-ref: ID | instance-port-ref

/instance-port-ref: ID /"." ID
```

The language module
-------------------

Finally, the `spicy/lang/expander.rkt` module exports the definitions
needed to expand Tiny-HDL code.
In this case, since the `begin-tiny-hdl` form is already part of the generated
syntax object, we do not redefine the `#%module-begin` macro:

```racket
#lang racket

(require tiny-hdl)

(provide
  (all-from-out tiny-hdl)
  xor and or not
  #%module-begin)
```

Getting the source code and running the examples
================================================

The source code for this step can be found in [branch step-06](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-06)
of the git repository for this project.

There are two new versions of the full adder example:

* [examples/half-adder-step-06-vanilla.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/half-adder-step-06-vanilla.rkt):
  the entity `half-adder` and its architecture `half-adder-arch`, using the *vanilla* flavor.
* [examples/full-adder-step-06-vanilla.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/full-adder-step-06-vanilla.rkt):
  the entity `full-adder` and its architecture `full-adder-arch`, using the *vanilla* flavor.
* [examples/full-adder-step-06-vanilla-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/full-adder-step-06-vanilla-test.rkt):
  the test module for the full adder using the *vanilla* flavor.
* [examples/half-adder-step-06-spicy.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/half-adder-step-06-spicy.rkt):
  the entity `half-adder` and its architecture `half-adder-arch`, using the *spicy* flavor.
* [examples/full-adder-step-06-spicy.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/full-adder-step-06-spicy.rkt):
  the entity `full-adder` and its architecture `full-adder-arch`, using the *spicy* flavor.
* [examples/full-adder-step-06-spicy-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-06/examples/full-adder-step-06-spicy-test.rkt):
  the test module for the full adder using the *spicy* flavor.

The implementations of both language flavors are available in folders
`vanilla/lang` and `spicy/lang` of the source tree.

Getting the source code for step 6
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket/step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-06`:

```
git checkout step-06
```

Running the examples
--------------------

Run `full-adder-step-06-vanilla-test.rkt` or `full-adder-step-06-spicy-test.rkt` with Racket:

```
racket examples/full-adder-step-06-vanilla-test.rkt
racket examples/full-adder-step-06-spicy-test.rkt
```

Conclusion
==========

When I started this project, I came to Racket with a very narrow conception
of what language-oriented programming was.
Using Racket was a refreshing experience, but also frustrating at times.

Using a language with an effective macro system was completely new to me.
Before learning Racket, the word "macro" reminded me of C's `#define`, and that
did not sound very exciting.
Now I have a completely different vision of what macros are and what they can
offer, especially in the context of language-oriented programming.

I found the concept of creating a language using macros, and the ability
to implement custom readers, very elegant.
However, implementing name resolution and cross-module bindings felt particularly
unintuitive at first, mainly due to my limited understanding of the macro
expansion process, and my ignorance of the available APIs.
This gave me the impression that Racket lacked maturity compared to other
language frameworks that I had used before.
Now I know that there is an ongoing effort to provide new APIs for DSL creation,
and this is very encouraging.

Since those difficulties are behind me, I can fully enjoy the reward of
getting a fully-working DSL, and I feel ready to start a new language
project with Racket.
