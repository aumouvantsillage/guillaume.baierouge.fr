---
title: First steps in the Mozilla Firefox OS Tablet Contribution Program
author: Guillaume Savaton
lang: en
date: 2014-07-27
draft: false
collection: posts
tags: Mozilla, Tablet, Firefox OS
template: post.html
---

In January this year, Mozilla [launched the Tablet Contribution Program](https://hacks.mozilla.org/2014/01/mozilla-launches-contribution-program-to-help-deliver-firefox-os-to-tablets/)
to help test and improve Firefox OS on tablet devices.
I volunteered as soon as the [applications opened](https://hacks.mozilla.org/2014/02/open-applications-tcp/)
and on the 1st of April, I received a confirmation that I was one of the 500 selected participants.
A few months passed. And two weeks ago, just before leaving for holyday, I finally received the tablet.

In this article, I will give an overview of my first impressions with the device.
More articles will come with details about what I am doing with it.

<!-- more -->

Background information
======================

I already own an Android tablet (Nexus 7, 2012) with Firefox as my main browser.
I have already been exposed to the use of web apps in Firefox for Android.

Except a quick overview of Firefox OS phones exposed at the Mozilla booth at FOSDEM 2014,
this is the first time I actually use Firefox OS.

Hardware specifications
=======================

The tablet that I received is a Foxconn InFocus New Tab F1 (Flatfish).
From the Quick Start guide, it appears that this tablet is originally meant to run Android.

As far as I understand, the goal of the program is not to test this specific hardware,
but to give feedback on the OS on a given *type* of device.
However, the features and the performance of the hardware can have an
impact on the overall user experience and it will be interesting to see how Firefox OS
benefits or suffers from these hardware specs.

Here is a side-by-side comparison of a few features of the Nexus 7 and the Flatfish:

<!---->     | Nexus 7                                 | Flatfish
------------|-----------------------------------------|---------
Processor   | Quad-core ARM Cortex A9, 1.3 GHz        | Quad-core ARM Cortex A7, 1.2 GHz
GPU         | Twelve-core Nvidia GeForce ULP, 416 MHz | PowerVR SGX544MP2
RAM         | 1 Gb                                    | 2 Gb
Storage     | 32 Gb                                   | 16 Gb
Screen size | 7 in, 1280x800                          | 10 in, 1280x800
Battery     | 4325 mAh                                | 7000 mAh

My first experiments are not conclusive concerning the performance of the processor and GPU.
However, I find the screen strikingly uncomfortable, maybe due to the fact that I am used
to watch a screen with a higher pixel density.

Using Firefox OS
================

The tablet comes with Firefox OS 1.4.0-0-prerelease.
I have decided to use it for a short period of time before attempting to upgrade the firmware.

Things that worked out of the box
---------------------------------

The initial setup worked fine.
Though the UI is available in French, the introductory tutorial was only in English.
I could perform the following tasks with no problem:

* Setting up a WIFI connection.
* Browsing the web.
* Adding my e-mail account and accessing my inbox.
* Taking photos using the stock photo app. The front and back cameras work fine.
* Using the GPS.

Annoying behaviors
------------------

The launcher is locked in landscape mode for no obvious reason.
Some apps, like the [Marketplace](https://marketplace.firefox.com/) or the
wheather [Forecast](https://marketplace.firefox.com/app/forecast), are locked in portrait mode.
As a consequence, I regularly need to change the orientation of the tablet.

Sometimes, the user interface responds with a small delay, or does not respond at all.
For instance, I often need to repeat the swipe gesture several times to
[open the notification tray](https://support.mozilla.org/en-US/kb/navigating-your-firefox-os-phone#w_see-your-notifications).

In the web browser, the address bar is attached to the top of the current page.
It move out of the screen when scrolling down, and if I want to show it again,
I need to scroll up to the top.
Firefox for Android does not behave like this: scrolling up a little at any point in the page
shows the address bar immediately.

The keyboard is too big.
Moreover, in portrait orientation, the keyboard layout is broken:
it seems that the size of the buttons is fixed, so when the
screen width is not sufficient, each row of keys is split in several rows.

Things that do not work as expected
-----------------------------------

After an app has been installed from the marketplace, it cannot be run immediately.
When launching the app for the first time, a directory view of the internal files of the app
is displayed.
Apps run correctly after rebooting the tablet.

I could not find how to switch between apps.
[The official instructions](https://support.mozilla.org/en-US/kb/how-to-switch-between-or-quit-apps)
indicate:

> To open the Application Manager, tap and hold the home button.

But the home button seems to be missing.

In the web browser, when a page has been displayed in landscape mode and the orientation is switched
to portrait, the page becomes unstable.

I did not find a *Caps lock* function on the keyboard.
