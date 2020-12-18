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
In the *name resolution* step, the checker introduces scopes in the abstract
syntax tree, and uses them to map each named reference to the corresponding
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
section in chapter 1, with a subsection about *Identifiers, bindings and scopes*.
But the API for managing *internal definition contexts* and creating bindings
is documented in the
[Syntax Transformers](https://docs.racket-lang.org/reference/stxtrans.html) section
in chapter 12.
In both sections, it is not obvious whether this documentation is specific to the
Racket language itself, or whether it can be also applied in the context of a DSL.

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

> When I started the implementation of Tiny-HDL in May 2020,
> `ee-lib` was still experimental and unpublished.
> I had the opportunity to read a draft of the aforementioned paper, kindly
> shared with me by Michael Ballantyne and Matthias Felleisen in reaction to
> [my questions on the *racket-users* mailing list](https://groups.google.com/g/racket-users/c/9FTGtrU_KC0/m/aO3ToAJoAgAJ).
>
> Browsing the source code of `ee-lib` was very informative, but there is still
> a lot in it that I don't fully understand.
> As an exercise, I ended up writing my own minimal scoping module for Tiny-HDL:
> it is basically a stripped-down version of the `ee-lib` API that provides just
> enough for my needs, without any attempt to be compatible with `ee-lib`
> or to address macro-extensibility concerns.

The implementation of scopes and name resolution in Tiny-HDL uses the following
functions and macros:

* `with-scope`: wraps its body in a new scope nested in the current scope.
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
or *identifier table*.

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

Its entry point is a `begin-tiny-hdl` form where the top-level scope is
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
This will rename the syntax classes into
`stx/entity`, `stx/architecture`,... and the structure types into
`meta/entity`, `meta/architecture`...

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
    ...))
```

`check-all` is a utility function that calls the thunks returned
by `checker` after processing a list of syntax objects:

```racket
(define (check-all lst)
  (map (λ (f) (f)) lst))
```

Entities
--------

When the current syntax object matches the `entity` syntax class,
the first pass creates an instance of the `entity` structure type
with a dictionary of `port`s, and adds a binding for the entity name
in the current scope.
An entity does not need to introduce a new scope.

The second pass returns the entity syntax object without modification.

```racket
(define (checker stx)
  (syntax-parse stx
    ...
    [e:stx/entity
     (bind! #'e.name (meta/make-entity
                       (for/hash ([p (in-list (attribute e.port))])
                         (define/syntax-parse q:stx/port p)
                         (values #'q.name (meta/port (syntax->datum #'q.mode))))))
     (thunk stx)]
    ...))
```

Architectures
-------------

When the current syntax object matches the `architecture` syntax class,
the first pass creates an instance of the `architecture` structure type
and adds a binding for the architecture name in the current scope.
The architecture body is processed recursively in a new scope.

In the second pass, we perform a lookup for the entity name attached to
the architecture.
This will raise a syntax error if no binding is found for that name, or if
the name does not refer to an entity.

The body is checked and the result is wrapped in a new `architecture` form.
The parameter `current-entity-name` will be used when checking expressions
that refer to ports of the current entity.

```racket
(define current-entity-name (make-parameter #f))

(define (checker stx)
  (syntax-parse stx
    ...
    [a:stx/architecture
     (bind! #'a.name (meta/architecture #'a.ent-name))
     (define body^ (with-scope
                     (~>> (attribute a.body)
                          (map add-scope)
                          (map checker))))
     (thunk/in-scope
       (lookup #'a.ent-name meta/entity?)
       (parameterize ([current-entity-name #'a.ent-name])
         #`(architecture a.name a.ent-name
             #,@(check-all body^))))]
    ...))
```

Instantiations
--------------

In the first pass, an instantiation statement creates an `instance` structure
and a binding for the instance name in the scope of the enclosing architecture
body.

In the second pass, a call to `lookup` checks that the architecture name
mentioned in the instantiation statement refers to an existing architecture.

```racket
(define (checker stx)
  (syntax-parse stx
    ...
    [i:stx/instance
     (bind! #'i.name (meta/instance #'i.arch-name))
     (thunk/in-scope
       (lookup #'i.arch-name meta/architecture?)
       stx)]
   ...))
```

Assignments and operations
--------------------------

When processing an assignment statement or an operation expression,
the first pass and the second pass
are applied recursively to the children syntax objects:

```racket
(define (checker stx)
  (syntax-parse stx
    ...
    [a:stx/assignment
     (define target^ (checker #'a.target))
     (define expr^   (checker #'a.expr))
     (thunk
       #`(assign #,(target^) #,(expr^)))]

    [o:stx/operation
     (define arg^ (map checker (attribute o.arg)))
     (thunk
       #`(o.op #,@(check-all arg^)))]
  ...))
```

Port references
---------------

Now the last cases are the main reason why we needed scoping and name
resolution in the first place.
Our goal is to convert expressions like `port-name` or `(inst-name port-name)`
into `(port-ref ...)` forms suitable for the code generation step.

In both cases, there is nothing to do in the first pass.

In the second pass, when the current syntax object matches the pattern `(inst-name port-name)`,
we perform the following operations:

1. Look-up `inst-name` and check that it refers to an existing instance.
2. Get the architecture name mentioned in that instance.
3. Retrieve the corresponding architecture information.
4. Get the entity name mentioned in that architecture.
5. Retrieve the corresponding entity information.
6. Check that `port-name` refers to an existing port in that entity.
7. Return a fully-resolved `port-ref` form.

```racket
(define (checker stx)
  (syntax-parse stx
    ...
    [(inst-name:id port-name:id)
     (thunk/in-scope
       (define/syntax-parse ent-name
         (~> #'inst-name
             (lookup meta/instance?)               ; (1)
             (meta/instance-arch-name)             ; (2)
             (lookup meta/architecture?)           ; (3)
             (meta/architecture-ent-name)))        ; (4)
       (~> #'ent-name
           (lookup meta/entity?)                   ; (5)
           (meta/entity-port-ref #'port-name))     ; (6)
       #'(port-ref ent-name port-name inst-name))] ; (7)

    [port-name:id
     (thunk/in-scope
       (define/syntax-parse ent-name (current-entity-name))
       (~> #'ent-name
           (lookup)                                ; (5)
           (meta/entity-port-ref #'port-name))     ; (6)
       #'(port-ref ent-name port-name))]           ; (7)

    [_ (thunk stx)])))
```

When the current syntax object is a simple identifier, the entity name
is read from the `current-entity-name` parameter.
Then we only need to apply the operations 5, 6, and 7.

Entry point of the semantic checker
-----------------------------------

Finally, we define a `begin-tiny-hdl` macro whose expansion will call
`checker` to perform the first pass, and will also call the returned thunk
to perform the second pass, hence the double parentheses:

```racket
(define-syntax (begin-tiny-hdl stx)
  (replace-context stx ((checker stx))))
```

The syntax object returned by the second pass comes annotated with scopes and
bindings.
If we pass this syntax object directly to the code generation step, the expander will
attempt to expand those bindings as if they were macros, which will raise errors.

As a solution, we call `replace-context` to restore the original syntactic context
of our syntax object.

Writing an example
==================

At this point, we are getting very close to the desired syntax for Tiny-HDL.
We can apply the following modifications to the full adder example:

* Wrap the Tiny-HDL code in a `begin-tiny-hdl` form.
* Replace the `port-ref` forms with simpler port references.

```racket
#lang racket

(require tiny-hdl)

(begin-tiny-hdl
  (entity half-adder ([input a] [input b] [output s] [output co]))

  (entity full-adder ([input a] [input b] [input ci] [output s] [output co]))

  (architecture half-adder-arch half-adder
    (assign s  (xor a b))
    (assign co (and a b)))

  (architecture full-adder-arch full-adder
    (instance h1 half-adder-arch)
    (instance h2 half-adder-arch)
    (assign (h1 a) a)
    (assign (h1 b) b)
    (assign (h2 a) (h1 s))
    (assign (h2 b) ci)
    (assign s      (h2 s))
    (assign co     (or (h1 co) (h2 co)))))
```

Getting the source code and running the example
===============================================

The source code for this step can be found in [branch step-03](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-03)
of the git repository for this project.
You will find the following new files:

* [lib/scope.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/scope.rkt):
  my minimal scoping module inspired by `ee-lib`.
* [lib/syntax.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/syntax.rkt):
  the syntax classes for Tiny-HDL.
* [lib/meta.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/meta.rkt):
  the structure types that capture compile-time information.
* [lib/checker.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/lib/checker.rkt):
  the implementation of the name resolution step.
* [examples/full-adder-step-03.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/examples/full-adder-step-03.rkt):
  the full adder example with support for name resolution.
* [examples/full-adder-step-03-test.rkt](https://github.com/aumouvantsillage/Tiny-HDL-Racket/blob/step-03/examples/full-adder-step-03-test.rkt):
  the main test program for this step.

Getting the source code for step 3
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-03`:

```
git checkout step-03
```

Running the example
-------------------

You will need to install the `threading` library:

```
raco pkg install threading-lib
```

Run `full-adder-step-03-test.rkt` with Racket:

```
racket examples/full-adder-step-03-test.rkt
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

Now try again after introducing errors in the example:

* By using names that do not resolve to anything:
  `(architecture full-adder-arch i-dont-exist)`.
* By using names that refer to the wrong kind of object:
  `(instance h1 h2)`.
