---
title: How to install the Pantheon desktop environment over Ubuntu 14.04
author: Guillaume Savaton
lang: en
date: 2016-03-28
update: 2016-04-03
draft: false
collection:
- posts
- stories
tags: Linux, Free Software
layout: post.njk
---

[Elementary OS](http://elementary.io/) is a Linux distribution that comes with its own desktop environment called Pantheon.
The developers do not officially support installing Pantheon separately from the rest of the distribution.
In fact, while Elementary OS Freya is based on Ubuntu 14.04, it requires [newer versions of several packages](https://launchpad.net/~elementary-os/+archive/ubuntu/os-patches/).

Fortunately, if your computer is already running Ubuntu 14.04, there is a reasonably easy way to transform
your existing setup into a seemingly genuine Elementary OS setup.

<!-- more -->

Several conversations can be found about this topic on the web, but the proposed solutions generally rely on the unstable package repositories
from the Elementary OS developers team.
I preferred to use the very same repositories as in an official installation of Elementary OS.

Here is the process that worked for me:

Adding the package repositories and installing the desktop environment
======================================================================

In a terminal, I ran the following commands.
They added the package repositories of the Elementary OS project, upgraded the already installed packages, and installed the Pantheon desktop environment.

```bash
sudo add-apt-repository ppa:elementary-os/stable
sudo add-apt-repository ppa:elementary-os/os-patches
sudo apt-get dist-upgrade
sudo apt-get install elementary-desktop
```

As far as I could see, a side-by-side comparison of the lists of installed packages in Elementary OS and in my modified Ubuntu showed only minor differences.

Fixing rendering issues
=======================

After rebooting, I chose the *Pantheon* session from the logging screen.
I found that the Applications menu (also known as *Slingshot Launcher*) did not work correctly:

* When I started typing the name of an application, it closed after the first keystroke.
* At the second attempt, the menu worked as expected, but its background was completely transparent.

There is [a bug report for this](https://bugs.launchpad.net/slingshot/+bug/1324463)
and [a workaround](https://bugs.launchpad.net/slingshot/+bug/1324463/comments/10) that consists in
disabling the *overlay scrollbars* used by the Unity desktop environment.
In a terminal, type the following commands:

```bash
gsettings set com.canonical.desktop.interface scrollbar-mode normal
killall slingshot-launcher
```

Setting up the Plymouth and LightDM themes (optional)
=====================================================

Show the Elementary logo at startup:

```bash
sudo update-alternatives --set default.plymouth /lib/plymouth/themes/elementary/elementary.plymouth
sudo update-initramfs -u
```

Use the Elementary theme for the logging screen:

```bash
sudo mv /usr/share/lightdm/lightdm.conf.d/{40,60}-pantheon-greeter.conf
```

One more fix
============

When launching GTK applications from the terminal, I usually got the following message:

```
Gtk-WARNING **: Unable to locate theme engine in module_path: “pixmap”
```

Installing the following package solved the issue:

```bash
sudo apt-get install gtk2-engines-pixbuf
```
