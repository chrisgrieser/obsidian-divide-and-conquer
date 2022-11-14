# ⚔️ Divide & Conquer

![](https://img.shields.io/github/downloads/chrisgrieser/obsidian-divide-and-conquer/total?label=Total%20Downloads&style=plastic) ![](https://img.shields.io/github/v/release/chrisgrieser/obsidian-divide-and-conquer?label=Latest%20Release&style=plastic) [![](https://img.shields.io/badge/changelog-click%20here-FFE800?style=plastic)](Changelog.md)

An [Obsidian](https://obsidian.md/) plugin that provides commands for bulk enabling/disabling of plugins and CSS Snippets. This allows you to quickly find which plugins are causing bugs or performance problems.
![DAC Snippet Demo](https://user-images.githubusercontent.com/31261158/201551797-0a278ec8-e6e9-4285-b633-bfec015e1c15.gif)


## How this helps with Debugging
You have a problem with Obsidian and have confirmed that the issue goes away when enabling safe mode. Now, you have to narrow down which plugin misbehaves. The most efficient method for doing so is called "bisecting", meaning that you disable half of the plugins, and depending on whether the issue still occurs or not, you can rule out one half of plugins.

Even though that process is the quickest method of finding the culprit-plugin, it is still quite cumbersome for power users who have 40, 50 or more plugins. *Divide & Conquer* provides some useful commands for bulk disabling/enabling of plugins, to make the power user's life easier.

## Commands Added
For either Plugin/Snippet:
- Reset - save the current state as the 'original state' (level 1)
- Restore - return to the original state*
- Bisect - Disable half of the active items, or if all are active (you're at 'level 0') return to the original state (level 1)
- Un-Bisect - Undo the last bisection, or enable all plugins if in the original state
- Re-Bisect - Undo the last bisection, then disable the other half

* ___After Resetting, DAC won't enable any plugins that you disable manually. Restoring only enables plugins that DAC disabled, and disables any that were already disabled when you last reset___

(Note that to be able to fulfill its duty, this plugin will never disable itself. The Hot Reload Plugin will also never be disabled, to avoid interference for developers.)

## Settings
The plugin/snippet exclusion is [regex](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) enabled, and you can exclude by author or description as well (e.g. 'command palette' to exclude any plugins that modify the command palette)
![DAC Settings Demo](https://user-images.githubusercontent.com/31261158/201551906-d6b732f5-66db-4747-9349-3efcb7aad3e9.gif)


## Installation
The plugin is available via Obsidian's Community Plugin Browser: `Settings` → `Community Plugins` → `Browse` → Search for *"Divide & Conquer"*

## Credits
Originally created by [chrisgrieser](https://github.com/chrisgrieser/) aka pseudometa, now maintained by [geoffreysflaminglasersword](https://github.com/geoffreysflaminglasersword).
