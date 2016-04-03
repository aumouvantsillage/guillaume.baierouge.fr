---
title: Installing Pantheon desktop over Ubuntu 14.04
author: Guillaume Savaton
lang: fr
date: 2016-03-28
update: 2016-03-28
draft: false
collection: posts
tags: Linux, Free Software
template: post.html
---

As a user of Elementary OS at home, I found myself in a very uncomfortable situation at work recently,
where I had to use a vanilla Ubuntu 14.04 setup.
I took a little time to try to install the Pantheon desktop on that computer but I stumbled upon some issues.
Here is the process that finally worked.

<!-- more -->

Add the package repositories and install the desktop environment
================================================================

Most articles I found on the web recommend to use the *daily* repository from the Elementary OS team.
However, I preferred to use the same APT sources that I had on my home computers running Elementary OS.

```bash
sudo add-apt-repository ppa:elementary-os/stable
sudo add-apt-repository ppa:elementary-os/os-patches
sudo apt-get dist-upgrade
sudo apt-get install elementary-desktop
```

Fix rendering issues
====================

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

Set up the Plymouth and LightDM themes (optional)
=================================================

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
