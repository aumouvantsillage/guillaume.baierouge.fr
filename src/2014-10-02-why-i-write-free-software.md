---
title: 5 reasons why I write free software
author: Guillaume Savaton
lang: en
date: 2014-10-02
draft: false
collection: posts
tags: Free software, Sozi
template: post.html
---

[Sozi](http://sozi.baierouge.fr) is a zooming presentation tool that I
have been developing for five years in my spare time.
Sozi is [free software](https://www.gnu.org/philosophy/free-sw.en.html).
It has gathered some enthusiastic and faithful users, and I usually
receive very positive feedback.

However, people do not always realize that Sozi is mainly the work of a
single person with the help of several contributors.
There is no company behind it, no structured development team,
no *professional-grade support*, and no ambition to gain *market shares*.

In this article, I will try to clarify my motivations for developing Sozi.

<!-- more -->

For me
======

Some call it [eating your own dog food](https://en.wikipedia.org/wiki/Eating_your_own_dog_food).
The main reason why I develop Sozi is that I am a user myself.

Sozi started as an experiment to see whether it was possible
to create [Prezi](http://prezi.com/)-like presentations using open standards.
I realized that I was not satisfied with slideshow software and I worked
to transform Sozi into an actual presentation tool that I could use.

While I am always disposed to improve Sozi, I tend to focus on the features that
I actually need.
Maybe you will find it selfish, but the time I can spend developing, testing and
maintaining Sozi is limited, so I need to set priorities.
For me, the top priority goes to features that I use regularly, because I have a
*natural* environment to test them, and a strong incentive to fix their bugs.

As a counter-example, let me mention the Sozi *media* extension that allows to add video
or audio to a Sozi presentation.
This is a feature that I have **never** used in any of my presentations.
I accepted to implement it because a user convinced me to do so and provided enough
technical information so that I could integrate it rapidly.
However, since I never use it, I do not feel concerned about it;
I do not take care to check for regressions when upgrading the rest of Sozi;
I do not notice bugs when they happen.
This is a sad situation.

I understand that you can feel disappointed if I do not implement a feature request that you proposed.
I prefer to encourage other contributors to join and develop features that they care about.

For you
=======

While I develop Sozi for my own use, I believe it can be useful for other people.
I also believe that diversity is a good thing.
When Sozi was released in 2010, the only other free SVG-based presentation tool was
[JessyInk](https://code.google.com/p/jessyink/).
JessyInk is slide-oriented, but it also supports zoomable *views*.
So we can consider that Sozi was among the first attempts to create an alternative to
[Prezi](http://prezi.com/) using open standards.

From the beginning, it was obvious that Sozi would be [free software](https://www.gnu.org/philosophy/free-sw.en.html).
All the tools that I use to develop Sozi are free software, so publishing Sozi under a free license
is my way to contribute to the free software ecosystem and give back what I receive from the community.

The source code of Sozi is available from a [public repository](https://github.com/senshu/Sozi).
As a consequence, you are not only a user of Sozi, but also a potential participant in its development:
* You can help [translate it into you native language](https://translations.launchpad.net/sozi) (the current Inkscape extension is available in 11 languages).
* You can [report issues and request features](https://github.com/senshu/Sozi/issues), but also investigate by yourself and propose solutions.
* You can make [a package for your preferred operating system](http://sozi.baierouge.fr/pages/install-linux.html).
  While it is limited to GNU/Linux distributions currently, I hope someone will make an installer for Windows or OS X.
* You can help other users by answering questions in the [discussion group](http://groups.google.com/group/sozi-users).

For fame
========

Like everybody else, I appreciate positive feedback
and messages of gratitude for my work.
Getting recognition is part of the motivations for people to publish their work
on the web today, I suppose.

If I was really seeking fame, I would try to communicate more and better,
make Sozi more visible, and make sure that my name is always associated with it.
But actually, I usually prefer to spend time coding than advertising Sozi.
I waited until this year to present it in an [international event](https://archive.fosdem.org/2014/schedule/event/sozi/).
The rest of the time, I do the minimum and let things happen.

So, if Sozi has gained some visibility over the years, this is mainly due to
some nice initiatives from the community, such as listing Sozi at
[alternativeto.net](http://alternativeto.net/software/prezi/),
writing an [article in the French Wikipedia](https://fr.wikipedia.org/wiki/Sozi),
and publishing tutorials an reviews on YouTube and in various blogs.

For money
=========

So you noticed these *Flattr*, *Bitcoin* and *Donate* buttons at the top of
[the web site of Sozi](http://sozi.baierouge.fr), didn't you?

At the time of this writing, I have earned a total amount of 91.74€
from 52 [Flattr](https://flattr.com) users since I created my account in 2010.
It is not a lot, but even a micro-donation shows that someone, somewhere,
finds my work useful.
Many thanks to all of you, who clicked that Flattr button, for your support!

I personally do not donate to the developers of every free software that I use,
so I do not expect to receive donations from all users of Sozi as well.
As a result, Sozi will probably not make me rich.

For fun
=======

Programming has been a passion since the age of 14.
I like to solve problems, learn new languages, discover new technologies.
And the web has made this activity even more fun:
creating and sharing code has never been so easy.

I develop Sozi because I enjoy doing it.

But there are many other things that I could do in my spare time,
than coding, fixing bugs and helping users.
I believe that I have no obligation to keep developing and
maintaining a piece of software if I don't find it interesting or enjoyable.
If it becomes boring, or if I feel that my family life suffers from it,
I will reconsider my involvement, hoping that someone else can follow up.

This has not happened yet :-)
