import { Command, ExtraButtonComponent, Notice, Plugin, PluginManifest, SettingsTab } from "obsidian";
import type { Composed, Func, JSONSetArrayMap, Mode } from "./util";
import { DACSettingsTab, DEFAULT_SETTINGS } from "./settings";
import { Modes, compose, getSnippetItems, makeArray, queryText, removeSetupDebugNotice, simpleCalc } from './util';

import { around } from 'monkey-around';

var tinycolor = require("tinycolor2");

const CSS_DELAY = 200; // delay after enabling/disabling css to allow for obsidian to relect changes before refreshing
const RESET_DELAY = 1000; // delay after resetting to allow for obsidian to relect changes before refreshing

// these interfaces allow a level of type checking for the arrays below
interface DACCommand { id: keyof divideAndConquer; name: string; }
interface DACButton { id: keyof divideAndConquer; tooltip: string; }
interface NameNID { name: string; id: string; author?: string; description?: string; }

/* eslint-disable @typescript-eslint/no-unused-vars */
// prettier-ignore
const pluginCommands: DACCommand[] = [
	{ id: "reset", 		name: "Plugin Reset - forget the original state and set the current state as the new original state" },
	{ id: "restore", 	name: "Plugin Restore - return to the original state" },
	{ id: "unBisect", 	name: "Plugin Un-Bisect - Undo the last bisection, or enable all plugins if in the original state" },
	{ id: "bisect", 	name: "Plugin Bisect - Disable half of the active plugins, or return to the original state if all plugins are active" },
	{ id: "reBisect", 	name: "Plugin Re-Bisect - Undo the last bisection, then disable the other half" },
];

const snippetCommands: DACCommand[] = [
	{ id: "reset", 		name: "Snippet Reset - forget the original state and set the current state as the new original state" },
	{ id: "restore", 	name: "Snippet Restore - return to the original state" },
	{ id: "unBisect", 	name: "Snippet Un-Bisect - Undo the last bisection, or enable all snippets if in the original state" },
	{ id: "bisect", 	name: "Snippet Bisect - Disable half of the active snippets, or return to the original state if all snippets are active" },
	{ id: "reBisect", 	name: "Snippet Re-Bisect - Undo the last bisection, then disable the other half" },
];

// the ordering of these determines the order in the settings tab
const UIButtons: DACButton[] = [
	{ id: "reset", 		tooltip: "Reset - Snapshot the current state" },
	{ id: "restore", 	tooltip: "Restore - Restore Snapshot" },
	{ id: "unBisect", 	tooltip: "UnBisect - Go up a level" },
	{ id: "bisect", 	tooltip: "Bisect - Go down a level" },
	{ id: "reBisect", 	tooltip: "Re-bisect - Go back a level, then down the other side" },
];

const icons: [keyof divideAndConquer, string][] = [
	["reset", "camera"],
	["restore", "switch-camera"],
	["unBisect", "expand"],
	["bisect", "minimize"],
	["reBisect", "flip-vertical"]
];
// prettier-ignore
/* eslint-enable @typescript-eslint/no-unused-vars */


export default class divideAndConquer extends Plugin {
	settings: typeof DEFAULT_SETTINGS;
	manifests = this.app.plugins.manifests;
	enabledColor: string = null;
	disabledColor: string = null;
	getItemEls: () => Element[];
	getAllItems: () => Set<NameNID>;
	getEnabledFromObsidian: () => Set<string>;
	enableItem: (item: string) => Promise<any>;
	disableItem: (item: string) => Promise<any>;
	getFilters: () => string[];

	private _mode: Mode = "plugins";
	public get mode(): Mode { return this._mode; }
	private setMode(mode: Mode) { this._mode = mode; } // this just makes it more explicit and easier to find where the mode is set

	mode2Call: Map<Mode, Composed> = new Map();
	mode2Refresh: Map<Mode, () => void> = new Map();
	mode2Tab: Map<Mode, SettingsTab> = new Map();
	mode2Controls: Map<Mode, HTMLElement[]> = new Map();
	mode2DisabledStates: Map<Mode, Set<string>[]> = new Map();
	mode2Snapshot: Map<Mode, Set<string>> = new Map();
	mode2Level: Map<Mode, number> = new Map(Modes.map(mode => [mode, 1]));
	key2Icon: Map<keyof divideAndConquer, string> = new Map(icons);
	disableButtons = false;

	get disabledState() { return this.mode2DisabledStates.get(this.mode) ?? []; }
	set disabledState(s) { this.mode2DisabledStates.set(this.mode, s ?? []); }

	get snapshot() { return this.mode2Snapshot.get(this.mode) ?? new Set(); }
	set snapshot(s) { this.mode2Snapshot.set(this.mode, s ?? new Set()); }

	get controls() { return this.mode2Controls.get(this.mode) ?? []; }
	set controls(c) { this.mode2Controls.set(this.mode, c ?? []); }

	get tab() { return this.mode2Tab.get(this.mode); }
	get wrapper() { return this.mode2Call.get(this.mode); }
	get refreshTab() { return this.mode2Refresh.get(this.mode); }
	set refreshTab(f: () => void) { this.mode2Refresh.set(this.mode, f); }

	set level(l) { this.mode2Level.set(this.mode, l); }
	get level() {
		if (!this.mode2Level.has(this.mode)) this.mode2Level.set(this.mode, 1);
		return this.mode2Level.get(this.mode);
	}


	async onunload() {
		this.saveData();
		console.log("Divide & Conquer Plugin unloaded.");
	}

	async onload() {
		await this.loadData();
		this.addSettingTab(new DACSettingsTab(this.app, this));
		console.log("Divide & Conquer Plugin loaded.");

		const notice = () => {
			removeSetupDebugNotice(); // these have no timeout
			let notic_str = `${this.mode} level:${this.level} `;
			if (this.level === 1) new Notice(notic_str + "- Now in the original state");
			else if (this.level === 0) new Notice(notic_str + "- Enabled All");
			else new Notice(notic_str);
		};

		const maybeReload = () => {
			if (this.settings.reloadAfterPluginChanges) setTimeout(() => this.app.commands.executeCommandById("app:reload"), 2000);
		};

		const maybeInit = () => {
			if (this.settings.initializeAfterPluginChanges) return this.app.plugins.initialize();
		};

		// mode2Call stores functions which, when called with a function, return composed functions that will automatically switch modes among other things
		this.mode2Call = new Map(Modes.map(mode => [mode, (f: Func) => async () => compose(this,
			() => this.setMode(mode),
			() => console.log('called: ', f.name),
			f, () => this.mode2Refresh.get(this.mode)(), maybeReload, maybeInit, notice
		).bind(this)()]));



		//////////// Pretty much anything that differs between modes is specified here //////////////

		// override the display of tabs to add controls
		this.mode2Tab = new Map<Mode, SettingsTab>(([
			["plugins", "community-plugins"],
			["snippets", "appearance"]
		] as [Mode, string][]).map(([mode, id]) => [mode, this.getSettingsTab(id) as SettingsTab]));

		// store mode specific info in the repective tab
		Object.assign(
			this.mode2Tab.get('plugins'),
			{ heading: 'Installed plugins', reloadLabel: 'Reload plugins', reload: () => this.app.plugins.loadManifests() });
		Object.assign(
			this.mode2Tab.get('snippets'),
			{ heading: 'CSS snippets', reloadLabel: 'Reload snippets', reload: () => this.app.customCss.loadSnippets() });

		[...this.mode2Tab.entries()].forEach(([mode, tab]) => this.register(around(tab, { display: this.overrideDisplay.bind(this, mode, tab) })));

		this.getItemEls = () => {
			switch (this.mode) {
				case 'plugins': return makeArray(this.tab.containerEl.find(".installed-plugins-container").children);
				case 'snippets': return getSnippetItems(this.tab);
				default: throw new Error("Unknown mode: " + this.mode);
			}
		};

		this.getAllItems = () => {
			switch (this.mode) {
				case 'plugins': return new Set(Object.values(this.manifests));
				case 'snippets': return new Set((this.app.customCss.snippets).map(s => ({ name: s, id: s })));
			}
		};

		this.getEnabledFromObsidian = () => {
			switch (this.mode) {
				case 'plugins': return this.app.plugins.enabledPlugins;
				// enabledSnippets can sometimes annoyingly include snippets that were removed without disabling 
				case 'snippets': return new Set(this.app.customCss.snippets.filter((snippet) => this.app.customCss.enabledSnippets.has(snippet)));
			}
		};

		this.enableItem = (id: string) => {
			switch (this.mode) {
				case 'plugins': return this.app.plugins.enablePluginAndSave(id);
				case 'snippets':
					return new Promise((resolve) => {
						this.app.customCss.setCssEnabledStatus(id, true);
						setTimeout(() => resolve({}), CSS_DELAY);
					});
			}
		};

		this.disableItem = (id: string) => {
			switch (this.mode) {
				case 'plugins': return this.app.plugins.disablePluginAndSave(id);
				case 'snippets':
					return new Promise((resolve) => {
						this.app.customCss.setCssEnabledStatus(id, false);
						setTimeout(() => resolve({}), CSS_DELAY);
					});
			}
		};

		this.getFilters = () => {
			switch (this.mode) {
				case 'plugins': return this.settings.pluginFilterRegexes;
				case 'snippets': return this.settings.snippetFilterRegexes;
			}
		};

		////////////////////////////////////////////////////////////////////////////////////////////

		this.addCommands();
		// when the workspace is ready, get the computed checkbox colors
		this.app.workspace.onLayoutReady(() => {
			let appContainer = document.getElementsByClassName("app-container").item(0) as HTMLDivElement;
			this.enabledColor ??= tinycolor(simpleCalc(appContainer.getCssPropertyValue('--checkbox-color'))).spin(180).toHexString();
			this.disabledColor ??= tinycolor(this.enabledColor).darken(35).toHexString();
		});
	}

	public async loadData() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await super.loadData());
		this.mode2DisabledStates = this.settings.disabledStates ? new Map(
			(Object.entries(JSON.parse(this.settings.disabledStates)) as JSONSetArrayMap)
				.map(([mode, states]) => [mode, states.map(state => new Set(state))])
		) : new Map();
		this.mode2Snapshot = this.settings.snapshots ? new Map(
			(Object.entries(JSON.parse(this.settings.snapshots)) as JSONSetArrayMap)
				.map(([mode, states]) => [mode, new Set(states)])
		) : new Map();
	}

	public async saveData(restore: boolean = true) {
		if (this.mode2DisabledStates) this.settings.disabledStates = JSON.stringify(Object.fromEntries(
			[...this.mode2DisabledStates.entries()].map(([mode, sets]) => [mode, [...sets].map(set => [...set])])
		));
		else this.settings.disabledStates = undefined;

		if (this.mode2Snapshot) this.settings.snapshots = JSON.stringify(Object.fromEntries(
			[...this.mode2Snapshot.entries()].map(([mode, set]) => [mode, [...set]])
		));
		else this.settings.snapshots = undefined;

		if (restore) await this.restore();
		await super.saveData(this.settings);
	}

	private addControls() {
		let container = this.getControlContainer();
		this.mode2Controls ??= new Map<Mode, HTMLDivElement[]>();
		if (!this.mode2Controls.has(this.mode)) this.mode2Controls.set(this.mode,
			[...UIButtons.map(o => new ExtraButtonComponent(container)
				.setTooltip(o.tooltip)
				.setIcon(this.key2Icon.get(o.id))
				.onClick(this.wrapCall(this.mode, o.id))
				.setDisabled(false).extraSettingsEl
			), this.createLevelText()]
		);
		this.controls.last().setText(`Level: ${this.mode2Level.get(this.mode)}`);
		this.controls.forEach(control => container.appendChild(control));
	}

	private addCommands() {
		type PC = Partial<Command>;
		pluginCommands.forEach(command => this.addCommand(
			Object.assign(command, { callback: this.mode2Call.get('plugins')(this[command.id] as Func) } as PC)
		));
		snippetCommands.forEach(command => this.addCommand(
			Object.assign(command, { callback: this.mode2Call.get('snippets')(this[command.id] as Func) } as PC)
		));
	}

	async bisect() {
		this.level = this.level + 1;
		if ((this.level) === 1) { this.restore(); return; }
		const { enabled } = this.getCurrentState();
		const half = await this.disableItems(enabled.slice(0, Math.floor(enabled.length / 2)));
		if (half.length > 0) this.disabledState.push(new Set(half));
		else this.level--;
		return half;
	}

	public async unBisect() {
		this.level = this.level > 0 ? this.level - 1 : 0;
		const { disabled } = this.getCurrentState();
		await this.enableItems(disabled);
		// this allows unbisect to turn on all plugins without losing the original state
		if (this.disabledState.length > 1) return this.disabledState.pop();
		return new Set();
	}

	public async reBisect() {
		if (this.level < 2) {
			new Notice("Cannot re-bisect the original state.");
			return;
		}
		const reenabled = await this.unBisect();
		const { enabled } = this.getCurrentState();
		const toDisable = enabled.filter(id => !reenabled.has(id));
		await this.disableItems(toDisable);
		if (toDisable.length > 0) {
			this.disabledState.push(new Set(toDisable));
			this.level = this.level + 1;
		}
	}


	public reset() {
		this.disabledState = this.snapshot = undefined;
		this.level = 1;
		let { enabled, disabled } = this.getEnabledDisabled();
		this.disabledState = [new Set(disabled)];
		this.snapshot = new Set(disabled);
		this.saveData(false);
	}

	public async restore() {
		if (this.disabledState.length < 1) return;
		// log the current time
		// ignore the first state (since it's the original state) and disable the rest in the order they were disabled
		this.disabledState.slice(1).reverse().map((set) => this.enableItems(set));
		await this.disableItems(this.snapshot);
		await this.app.plugins.requestSaveConfig();
		setTimeout(() => this.reset(), RESET_DELAY); // obsidian takes it's sweet time to update which plugins are enabled even after the promise resolves
	}

	public getCurrentState() {
		const { enabled, disabled } = this.getEnabledDisabled();
		this.disabledState = this.disabledState.length < 1 ? [new Set(disabled)] : this.disabledState;
		const currentDisabled = this.disabledState.last();
		return { enabled, disabled: currentDisabled };
	}

	public getEnabledDisabled() {
		// the whole point of using sets is constant time lookup, but js is dumb and does strict object equality with no allowance for custom comparators
		// with our small data sets, it probably won't hurt performance but this is technically O(n^2)
		let excluded = [...this.getExcludedItems()];
		let included = [...this.getAllItems()].filter(item => !excluded.some(i => i.id === item.id))
			.sort((a, b) => b.name.localeCompare(a.name)) // sort by display name rather than id
			.map((item) => item.id);
		let result = {
			enabled: included.filter(id => this.getEnabledFromObsidian().has(id)),
			disabled: included.filter(id => !this.getEnabledFromObsidian().has(id))
		};
		return result;
	}

	public getIncludedItems(mode?: Mode) {
		return this.getExcludedItems(mode, true);
	}

	public getExcludedItems(mode?: Mode, outIncluded: boolean = false) {
		let oldmode = this.mode;
		if (mode) this.setMode(mode);
		const plugins = [...this.getAllItems()].filter(
			(p: NameNID) => outIncluded !== this.getFilters().some(
				filter => p.id.match(new RegExp(filter, "i"))
					|| (this.settings.filterUsingDisplayName && p.name.match(new RegExp(filter, "i")))
					|| (this.settings.filterUsingAuthor && p.author?.match(new RegExp(filter, "i")))
					|| (this.settings.filterUsingDescription && p.description?.match(new RegExp(filter, "i")))
			));
		if (mode) this.setMode(oldmode);
		return new Set(plugins);
	}

	// enables in the reverse order that they were disabled (probably not necessary, but it's nice to be consistent)
	async enableItems(items: string[] | Set<string>) {
		if (items instanceof Set) items = [...items];
		console.log("Enabling:", items);
		items.reverse().map(id => this.enableItem(id));
		return items;
	}

	async disableItems(items: string[] | Set<string>) {
		if (items instanceof Set) items = [...items];
		console.log("Disabling:", items);
		for (const id of items) {
			await this.disableItem(id);
		}
		return items;
	}

	getControlContainer(tab?: SettingsTab) {
		tab ??= this.tab;
		return queryText(tab.containerEl, ".setting-item-heading", tab.heading).querySelector(".setting-item-control") as HTMLElement;
	}

	getReloadButton(tab?: SettingsTab) {
		tab ??= this.mode2Tab.get(this.mode);
		let controls = this.getControlContainer(tab);
		return controls.find(`[aria-label="${tab.reloadLabel}"]`) as HTMLDivElement;
	}

	getSettingsTab(id: string) {
		return this.app.setting.settingTabs.filter(t => t.id === id).shift() as Partial<SettingsTab>;
	}

	private createLevelText() {
		let span = document.createElement("span");
		span.setText(`Level: ${this.level}`);
		return span;
	}

	private overrideDisplay(mode: Mode, tab: SettingsTab, old: any) {
		let plugin = this;
		return (function display(...args: any[]) {
			plugin.setMode(mode);
			plugin.refreshTab = () => {
				console.log("refreshing tab", mode);
				plugin.setMode(mode);
				tab.reload().then(() => {
					old.apply(tab, args); // render the tab after re-loading the plugins/snippets
					plugin.addControls(); // add the controls back
					plugin.colorizeIgnoredToggles();
					// let reload = plugin.getReloadButton();
					// reload.onClickEvent = () => plugin.refreshTab();
				});
			};
			plugin.refreshTab();
		}).bind(plugin, tab);
	}


	private colorizeIgnoredToggles() {
		let name2Toggle = this.createToggleMap(this.getItemEls());
		// for now, regex filtering is only for plugins
		let included = new Set([...(this.getIncludedItems())].map(m => m.name));
		console.log('included', included, this.getIncludedItems(), name2Toggle);

		for (let [name, toggle] of name2Toggle) {
			// if the plugin is filtered by regex settings, we indicate this visually by coloring the toggle
			if (!included?.has(name)) {
				let colorToggle = () => {
					if (toggle.classList.contains('is-enabled')) toggle.style.backgroundColor = this.enabledColor;
					else toggle.style.backgroundColor = this.disabledColor;
				};
				colorToggle();
				toggle.addEventListener('click', colorToggle);
			}

			let id = [...this.getAllItems()].find(p => p.name == name)?.id;
			// if the plugin is in the snapshot, we indicate this visually by outlining
			if (id && this.snapshot && this.snapshot.has(id)) {
				toggle.style.outlineOffset = "1px";
				toggle.style.outline = "outset";
			}
		}

	}

	private createToggleMap(items: Element[]) {
		let name2Toggle = new Map<string, HTMLDivElement>();
		for (var i = 0; i < items.length; i++) {
			let child = items[i];
			let name = (child.querySelector(".setting-item-name") as HTMLDivElement).innerText;
			let toggle = (child.querySelector(".setting-item-control")).querySelector('.checkbox-container') as HTMLDivElement;
			if (name && toggle)
				name2Toggle.set(name, toggle);
		}
		return name2Toggle;
	}

	private wrapCall(mode: Mode, key: keyof divideAndConquer) {
		return this.wrapper(this[key] as Func);
	}



}

