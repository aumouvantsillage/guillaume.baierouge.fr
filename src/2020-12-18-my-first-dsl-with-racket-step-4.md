---
title: "My first domain-specific language with Racket. Step 4: Design rule checks"
lang: en
date: 2020-12-18
update: 2020-12-20
draft: false
collection: posts
tags: Domain-Specific Language, Racket
template: post.html
---

In this post, we add more semantic checks.
A circuit description will be considered correct if it respects some common
electronic design rules.

<!-- more -->

Here is a list of rules that we want to check:

* All the output ports of an architecture must be the assigned one, and only one time in this architecture.
* All the input ports of an instance must be assigned one, and only one time in the enclosing architecture.
* An input port of an architecture cannot be assigned.
* An output port of an instance cannot be assigned.

> Edit 2020-12-20:
>
> Two other rules could be added to this list.
> They are not implemented at the moment, but will possibly be in the future:
>
> * Recursive instanciations are forbidden.
> * Combinational loops (when a signal depends on itself) are forbidden.

Checking architectures and instances
====================================

When checking an architecture, a parameter `current-assignment-targets` will store
a set of all the targets of assignment statements in the body of this architecture.
This set will be filled in a new function `collect-assignment-targets` that
will be explained in a moment.

Then, a function `check-all-assigned` will check that every output port of the
current architecture matches an element of that set.

```racket
(define current-entity-name (make-parameter #f))
(define current-assignment-targets (make-parameter #f))

(define (checker stx)
  (syntax-parse stx
    ...
    [a:stx/architecture
     ...
     (thunk/in-scope
       ...
       (parameterize ([current-entity-name #'a.ent-name]
                      [current-assignment-targets (collect-assignment-targets (attribute a.body))])
         (check-all-assigned stx)
         #`(architecture a.name a.ent-name
             #,@(check-all body^))))]

    [i:stx/instance
     ...
     (thunk/in-scope
       (~> #'i.arch-name
           (lookup meta/architecture?)
           (meta/architecture-ent-name)
           (check-all-assigned stx #'i.name _))
       stx)]

    ...))
```

When checking an instance, we will first retrieve the name of the
entity where its ports are declared, then the same function `check-all-assigned`
will check that every input port of that entity matches an element from the set
of assigned targets in the enclosing architecture.

In this situation, `check-all-assigned` will receive two additional arguments:
the instance name and the entity name.

Collecting the assignment targets
---------------------------------

The argument of `collect-assignment-targets` is a list of statements.
In case of success, it returns a set of *target IDs*.
If the same target is assigned more than one time, an error is raised.

```racket
(define (collect-assignment-targets stmt-lst)
  (for/fold ([acc  (set)])
            ([stmt (in-list stmt-lst)])
    (syntax-parse stmt
      [a:stx/assignment
       (define target-id (syntax->datum #'a.target))
       (when (set-member? acc target-id)
         (define port-name (if (list? target-id) (second target-id) target-id))
         (raise-syntax-error port-name "Port is assigned more than one time" #'a.target))
       (set-add acc target-id)]

      [_ acc])))
```

In an assignment statement, the `target` attribute can take the form `port-name`
or `(inst-name port-name)`.
The value of the `target` attribute is converted from a syntax object to a datum
that will constitute a unique target ID in the context of the current architecture.

Checking assignment exhaustivity
--------------------------------

Depending on its arguments, `check-all-assigned` will check that all
output ports of an architecture, or all input ports of an instance, have
matching target IDs in the current set of assignment targets.

The existence of an `inst-name` argument will determine whether we are
checking an architecture or an instance.

* When checking an architecture, the entity name is retrieved from the
  `current-entity-name` parameter. The ports to check are outputs.
* When checking an instance, the entity name is passed as an argument.
  The ports to check are inputs.

```racket
(define (check-all-assigned ctx [inst-name #f] [ent-name (current-entity-name)])
  (define mode (if inst-name 'input 'output))
  (for ([(port-name port) (in-dict (meta/entity-ports (lookup ent-name meta/entity?)))]
        #:when (eq? mode (meta/port-mode port)))
    (define port-name^ (syntax->datum port-name))
    (define target-id (if inst-name
                        (list (syntax->datum inst-name) port-name^)
                        port-name^))
    (unless (set-member? (current-assignment-targets) target-id)
      (raise-syntax-error port-name^ "Port is never assigned" ctx)))))
```

After looking up the entity, the `for` loop will iterate on the ports that have
the appropriate mode.
For each port, it will create a corresponding target ID and will check that it
belongs to the current set of assignment targets.

Checking assignment statements
==============================

When checking an assignment statement, we need to check that the mode of
the target port is:
`output` in an assignment to a port of the current architecture;
`input` in an assignment to a port of an instance.

To determine the expected and actual modes of the port, we use the fully
resolved version of the target port reference, `(target^)` that can take
one of these forms:

* `(port-ref ent-name port-name)`,
* or `(port-ref ent-name port-name inst-name)`.

The *expected* mode is determined by the existence of an instance name;
the *actual* mode is retrieved by looking up the entity and inspecting the target port.
An error is raised if the modes are not equal.

```racket
(define (checker stx)
  (syntax-parse stx
    ...

    [a:stx/assignment
     (define target^ (checker #'a.target))
     (define expr^   (checker #'a.expr))
     (thunk/in-scope
       (define target* (target^))
       (define/syntax-parse (_ ent-name port-name (~optional inst-name)) target*)
       (define expected-mode (if (attribute inst-name) 'input 'output))
       (define actual-mode (~> #'ent-name
                               (lookup)
                               (meta/entity-port-ref #'port-name)
                               (meta/port-mode)))
       (unless (eq? expected-mode actual-mode)
         (raise-syntax-error (syntax->datum #'port-name) "Invalid target for assignment" stx))
       #`(assign #,target* #,(expr^)))]

    ...))
```

Getting the source code and running the examples
================================================

The source code for this step can be found in [branch step-04](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-04)
of the git repository for this project.

It comes with several examples that each violate a specific rule.
See the `error-...-step-04.rkt` files in the [examples](https://github.com/aumouvantsillage/Tiny-HDL-Racket/tree/step-04/examples)
folder.

Getting the source code for step 4
----------------------------------

Assuming you have already [cloned the git repository](/2020/11/16/my-first-domain-specific-language-with-racket.-step-1:-execution/#getting-the-source-code-for-step-1),
switch to branch `step-04`:

```
git checkout step-04
```

Running the examples
--------------------

Each example file whose name begins with `error` will raise an error message
when run like this:

```
racket examples/error-...-step-04.rkt
```

The full adder example from step 3 should still work:

```
racket examples/full-adder-step-03-test.rkt
```
