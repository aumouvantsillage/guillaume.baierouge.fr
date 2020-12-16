---
title: "My first domain-specific language with Racket. Step 3: Name resolution"
lang: en
date: 2020-12-15
update: 2020-12-15
draft: false
collection: posts
tags: Domain-Specific Language, Racket
template: post.html
---

The semantic checker for Tiny-HDL will be written in two steps.
In the name resolution step, the checker introduces scopes in the abstract
syntax tree, and uses them to associate each named reference to the corresponding
declaration.

<!-- more -->

In my journey through the Racket world, this is the place where things started
to get frustrating for me.

In my previous DSL projects, I have always taken for granted that a language
development framework should provide facilities for scoping and name resolution,
and that these facilities would deserve to be put in the spotlight in
the reference documentation as well as in the tutorials.
For instance, the [Xtext](https://www.eclipse.org/Xtext/) documentation has
easy-to-reach sections for its [linking](https://www.eclipse.org/Xtext/documentation/303_runtime_concepts.html#linking)
feature, and its [scoping API](https://www.eclipse.org/Xtext/documentation/303_runtime_concepts.html#scoping).

Until recently, I could not find similar documents in the Racket literature:
the chapter [Creating languages](https://docs.racket-lang.org/guide/languages.html)
of the Racket guide, or the book [Beautiful Racket](https://beautifulracket.com),
do not address this topic at all.

The Racket reference, however, contains a lot of information, but it is not
organized as a beginner-level, step-by-step guide.
For instance, searching for *scopes* will lead to the
[Syntax Model](https://docs.racket-lang.org/reference/syntax-model.html)
page, with a section about *Identifiers, bindings and scopes*.
But the API for managing *internal definition contexts* and creating bindings
is documented in the
[Syntax Transformers](https://docs.racket-lang.org/reference/stxtrans.html) page.
In both cases, it is not obvious whether this documentation is specific to the
implementation of Racket itself, or whether it can be applied in the context of a DSL.

An API for scopes and bindings in Racket
========================================

In their paper [Macros for Domain-Specific Languages](https://dl.acm.org/doi/pdf/10.1145/3428297)
(Proc. ACM Program. Lang. Vol. 4, OOPSLA, Article 229, November 2020),
Michael Ballantyne, Alexis King and Matthias Felleisen present an architecture
for implementing macro-extensible hosted DSLs.
While extensibility is the key topic of the article, page 12 proposes a new API
that addresses the management of scopes and bindings in the compile-time
environment of a DSL.

The API is now available under the name `ee-lib`.
It has an official [documentation page](https://docs.racket-lang.org/ee-lib/index.html)
that has been updated very recently, and its source code
is available [in a GitHub repository](https://github.com/michaelballantyne/ee-lib).

> At the time when I started the implementation of Tiny-HDL (in May 2020),
> `ee-lib` was still experimental and unpublished.
> I had the opportunity to read a draft of the aforementioned paper, kindly
> shared with me by Michael Ballantyne and Matthias Felleisen in reaction to
> [my questions on the *racket-users* mailing list](https://groups.google.com/g/racket-users/c/9FTGtrU_KC0/m/aO3ToAJoAgAJ).
>
> Since I wanted to use officially available material only,
> I ended up writing my own minimal scoping module: it is basically a
> stripped-down version of the `ee-lib` API that provides just enough
> for my needs, without any attempt to be compatible with `ee-lib`
> or to address macro-extensibility concerns.

The implementation of scopes and name resolution in Tiny-HDL uses the following
functions and macros:

* `with-scope`: wraps its body in a new scope.
* `add-scope`: decorates a syntax object with scope information.
* `bind!`: creates a binding for a given name in the the current scope, and maps this binding to some given data.
* `lookup`: looks for a binding in the current scope and returns its corresponding data.

They are based on four functions from the Racket standard library:

* [`syntax-local-make-definition-context`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._syntax-local-make-definition-context%29%29)
  is used in the implementation of `with-scope`, together with a parameter to
  keep track of the current context.
* [`internal-definition-context-introduce`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._internal-definition-context-introduce%29%29)
  is basically the same as `add-scope`.
* [`syntax-local-bind-syntaxes`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._syntax-local-bind-syntaxes%29%29)
  is basically the same as `bind!`.
* [`syntax-local-value`](https://docs.racket-lang.org/reference/stxtrans.html#%28def._%28%28quote._~23~25kernel%29._syntax-local-value%29%29)
  is used in the implementation of `lookup`.

This code fragment is taken from the file [lib/scope.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/scope.rkt)
available in the Tiny-HDL source repository:

```racket
(define current-scope (make-parameter #f))

(define-syntax-rule (with-scope* sc body ...)
  (parameterize ([current-scope sc])
    body ...))

(define-syntax-rule (with-scope body ...)
  (with-scope* (syntax-local-make-definition-context (current-scope))
    body ...))

(define (add-scope stx)
  (internal-definition-context-introduce (current-scope) stx 'add))

(define (bind! name data)
  (syntax-local-bind-syntaxes (list name) #`'#,data (current-scope)))

(define (lookup name [pred (λ (x) #t)])
  (define res (syntax-local-value name
                (λ () (raise-syntax-error #f "No declaration found for this identifier" name))
                (current-scope)))
  (unless (pred res)
    (raise-syntax-error #f "Cannot be used in this context" name))
  res)
```

The macro `thunk/in-scope` below is a minor personal addition that allows to create a
*thunk* (a *lambda* with zero argument) whose body has access to the current scope:

```racket
(define-syntax-rule (thunk/in-scope body ...)
  (let ([sc (current-scope)])
    (thunk (with-scope* sc body ...))))
```

Syntax classes
==============

To facilitate the manipulation of syntax objects in the Tiny-HDL checker, I have
decided to describe the supported syntax patterns in the form of
[syntax classes](https://docs.racket-lang.org/syntax/stxparse-specifying.html?q=syntax%20classes).

> Coming from Model-Driven Engineering, my initial understanding of syntax
> classes was that they played the same role as a metamodel.
> However, there are major differences:
> a syntax class is not a *class* in the object-oriented sense;
> it specifies *patterns* that a syntax object can match against,
> but there is no class-instance relationship between them.
>
> As a consequence, you cannot directly query an object to get the value
> of an attribute that is declared in a syntax class.
> You need to use pattern matching.

In this step, I have used syntax classes to abstract the supported
syntax patterns in Tiny-HDL.
The following definitions can be considered as the *grammar* of Tiny-HDL.
The code fragments are taken from the file [lib/syntax.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/syntax.rkt)
available in the Tiny-HDL source repository:

Entities
--------

An entity is introduced by the literal `entity`, followed by its name
and a list of ports.
A port is defined by its mode (`input` or `output`), and its name:

```racket
(define-syntax-class entity
  #:literals [entity]
  (pattern (entity name:id (port:port ...))))

(define-syntax-class port
  #:datum-literals [input output]
  (pattern (mode:input  name:id))
  (pattern (mode:output name:id)))
```

Architectures
-------------

An architecture is introduced by the literal `architecture` followed by
its name and the name of an entity.
The architecture body is a sequence of statements:

```racket
(define-syntax-class architecture
  #:literals [architecture]
  (pattern (architecture name:id ent-name:id body:statement ...)))
```

Statements
----------

Tiny-HDL supports two kinds of statements: instantiations and assignments.
An instantiation is introduced by the literal `instance` followed by
the name of the instance and the name of an architecture;
an assignment is composed of the literal `assign` followed by a target
port reference and an expression:

```racket
(define-syntax-class statement
  (pattern :instance)
  (pattern :assignment))

(define-syntax-class instance
  #:literals [instance]
  (pattern (instance name:id arch-name:id)))

(define-syntax-class assignment
  #:literals [assign]
  (pattern (assign target:port-ref expr:expression)))
```

Expressions
-----------

The three kinds of supported expressions are:

* port references, either a port name, or a list containing an instance name and a port name;
* boolean operations, an operation name followed by one, two, or an arbitrary number of arguments depending on the arity of the operation;
* boolean literals.

```racket
(define-syntax-class expression
  (pattern :port-ref)
  (pattern :operation)
  (pattern :boolean))

(define-syntax-class port-ref
  (pattern port-name:id)
  (pattern (inst-name:id port-name:id)))

(define-syntax-class operation
  #:literals [not and or xor]
  (pattern (op:not a:expression)
    #:attr (arg 1) (list #'a))
  (pattern (op:xor a:expression b:expression)
    #:attr (arg 1) (list #'a #'b))
  (pattern (op:and arg:expression ...))
  (pattern (op:or arg:expression ...))))
```

Compile-time data types
=======================

A common design pattern in Racket is to create structure types to represent
the compile-time information needed during the semantic checking and code
transformation steps.
During the name resolution step of Tiny-HDL, we will use `bind!` to store information
about the named elements that we find, and we will use `lookup` to retrieve this information.
The structure types that we will use are declared below.

For an entity, we will store its port definitions in a special
[dictionary with identifier keys](https://docs.racket-lang.org/syntax/syntax-helpers.html?q=free-id-table#%28part._idtable%29),
(or *identifier table*).

```racket
(struct entity (ports))

(define (make-entity ports)
  (entity (make-immutable-free-id-table ports)))

(define (entity-port-ref ent name)
  (dict-ref (entity-ports ent) name
    (λ () (raise-syntax-error #f "No port declaration found for this identifier" name))))

(struct port (mode))
```

For an architecture, we will only store the entity name,
and for an instance, the architecture name:

```racket
(struct architecture (ent-name))

(struct instance (arch-name))
```

The code fragments above are taken from the file [lib/meta.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/meta.rkt)
available in the Tiny-HDL source repository.

The semantic checker
====================

The semantic checker is implemented in the file [lib/checher.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/checker.rkt).

Its entry point is a macro `begin-tiny-hdl` where the top-level scope is
created before calling the checker function.
The checker itself runs in two passes:

1. The first pass annotates the source syntax object with scopes,
   it computes compile-time information and creates bindings for named elements.
2. The second pass resolves named references, checks that they are valid,
   and generates a syntax object suitable for code generation.

I have written a single function `checker` that contains the logic for both passes.
When called, `checker` executes the first pass immediately and returns a
function (a *thunk*) that will perform the second pass.
Here is a template of the `checker` function:

```racket
(define (checker stx)
  (syntax-parse stx
    #:literals [...]

    [some-pattern
     ; Perform the first pass here.
     ...
     (thunk
       ; Perform the second pass here and return a syntax object.
       ...
       #'some-stx)]

    ...))
```

If the thunk needs to perform lookups, we will use `thunk/in-scope` to give it
access to the current scope.

In the code fragments below, the `lib/syntax.rkt` and `lib/meta.rkt`
are `require`d with prefixes `stx/` and `meta/` respectively.
We will also make use of the `~>` and `~>>` macros from the
[`threading`](https://docs.racket-lang.org/threading/index.html) module.

```racket
(require
  "expander.rkt"
  (prefix-in stx/ "syntax.rkt")
  (for-syntax
    threading
    racket/function
    syntax/parse
    syntax/strip-context
    "scope.rkt"
    (prefix-in meta/ "meta.rkt")))
```

Top-level scope
---------------

We define the following utility function that calls the thunks returned
by the `checker` function after processing a list of syntax objects:

```racket
(define (check-all lst)
  (map (λ (f) (f)) lst))
```

The first pattern that we will match corresponds to the `begin-tiny-hdl`
form.
In the first pass, it processes its body by calling `checker` recursively
in the context of a new scope.
In the second pass, it generates a `begin` form
that contains the result of the second pass for its body.

```racket
(define (checker stx)
  (syntax-parse stx
    #:literals [begin-tiny-hdl]

    [(begin-tiny-hdl body ...)
     (define body^ (with-scope
                     (~>> (attribute body)
                          (map add-scope)
                          (map checker))))
     (thunk
       #`(begin
           #,@(check-all body^)))]
    ...
```
