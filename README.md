# ⚔️ Divide & Conquer

![](https://img.shields.io/github/downloads/chrisgrieser/obsidian-divide-and-conquer/total?label=Total%20Downloads&style=plastic) ![](https://img.shields.io/github/v/release/chrisgrieser/obsidian-divide-and-conquer?label=Latest%20Release&style=plastic) [![](https://img.shields.io/badge/changelog-click%20here-FFE800?style=plastic)](Changelog.md)

An [Obsidian](https://obsidian.md/) plugin that provides commands for bulk enabling/disabling of plugins and CSS Snippets. Useful for debugging when you have many plugins or CSS snippets.

## Table of Contents
<!-- MarkdownTOC levels="2" -->

- [How this helps with Debugging](#how-this-helps-with-debugging)
- [Commands Added](#commands-added)
- [Conquer CSS Snippets](#conquer-css-snippets)
- [Installation](#installation)
- [Contribute](#contribute)
- [About the Developer](#about-the-developer)

<!-- /MarkdownTOC -->

## How this helps with Debugging
You have a problem with Obsidian and have confirmed that the issue goes away when enabling safe mode. Now, you have to narrow down which plugin misbehaves. The most efficient method for doing so is called "bisecting", meaning that you disable half of the plugins, and depending on whether the issue still occurs or not, you can rule out one half of plugins.

Even though that process is the quickest method of finding the culprit-plugin, it is still quite cumbersome for power users who have 40, 50 or more plugins. *Divide & Conquer* provides some useful commands for bulk disabling/enabling of plugins, to make the power user's life easier.

## Commands Added
- Disable half of the enabled plugins
- Enable half of the disabled plugins
- Disable all plugins
- Enable all plugins
- Toggle all plugins (Disable enabled plugins & enable disabled ones)
- Count enabled and disabled plugins

(Note that to be able to fulfill its duty, this plugin will never disable itself. The Hot Reload Plugin will also never be disabled, to avoid interference for developers.)

## Conquer CSS Snippets
You can also divide and conquer your CSS snippets, the commands and the mechanics are exactly the same.

## Installation
The plugin is available via Obsidian's Community Plugin Browser: `Settings` → `Community Plugins` → `Browse` → Search for *"Divide & Conquer"*

## Contribute
Please use the `.eslintrc` configuration located in the repository and run eslint before doing a pull request, and please do *not* use `prettier`. 🙂

```shell
# Run eslint fixing most common mistakes
eslint --fix *.ts
```

## About the Developer
In my day job, I am a sociologist studying the social mechanisms underlying the digital economy. For my PhD project, I investigate the governance of the app economy and how software ecosystems manage the tension between innovation and compatibility. If you are interested in this subject, feel free to get in touch!

<!-- markdown-link-check-disable -->
### Profiles
- [Academic Website](https://chris-grieser.de/)
- [ResearchGate](https://www.researchgate.net/profile/Christopher-Grieser)
- [Discord](https://discordapp.com/users/462774483044794368/)
- [GitHub](https://github.com/chrisgrieser/)
- [Twitter](https://twitter.com/pseudo_meta)
- [LinkedIn](https://www.linkedin.com/in/christopher-grieser-ba693b17a/)

### Donate
<a href='https://ko-fi.com/Y8Y86SQ91' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
