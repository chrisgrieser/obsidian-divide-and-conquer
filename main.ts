import { Command, ExtraButtonComponent, Notice, Plugin, PluginManifest, SettingsTab } from "obsidian";
import type { Composed, Func, JSONSetArrayMap, Mode } from "./util";
import { DACSettingsTab, DEFAULT_SETTINGS } from "settings";
import { Modes, compose, getSnippetItems, makeArray, queryText, removeSetupDebugNotice, simpleCalc } from './util';

import { around } from 'monkey-around';

var tinycolor = require("tinycolor2");

// these interfaces allow a level of type checking for the arrays below
interface DACCommand { id: keyof divideAndConquer; name: string; }
interface DACButton { id: keyof divideAndConquer; tooltip: string; }

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
	{ id: "reset", 		tooltip: "Bisect - Go down a level" },
	{ id: "restore", 	tooltip: "Re-bisect - Go back a level, then down the other side" },
	{ id: "unBisect", 	tooltip: "Restore - Restore Snapshot" },
	{ id: "bisect", 	tooltip: "Reset - Snapshot the current state" },
	{ id: "reBisect", 	tooltip: "UnBisect - Go up a level" },
];

const icons: [keyof divideAndConquer, string][] = [
	["reset", "camera"],
	["restore", "switch-camera"],
	["unBisect", "expand"],
	["bisect", "minimize"],
	["reBisect", "flip-vertical"]
];
// prettier-ignore


export default class divideAndConquer extends Plugin {
	settings: typeof DEFAULT_SETTINGS;
	manifests = this.app.plugins.manifests;
	enabledColor: string = null;
	disabledColor: string = null;
	getItems: () => Element[];

	mode: Mode = "plugins";
	mode2Call: Map<Mode, Composed> = new Map();
	mode2Refresh: Map<Mode, () => void> = new Map();
	mode2Tab: Map<Mode, SettingsTab> = new Map();
	mode2Controls: Map<Mode, HTMLElement[]> = new Map();
	mode2DisabledStates: Map<Mode, Set<string>[]> = new Map();
	mode2Snapshot: Map<Mode, Set<string>> = new Map();
	mode2Level: Map<Mode, number> = new Map(Modes.map(mode => [mode, 1]));
	key2Icon: Map<keyof divideAndConquer, string> = new Map(icons);

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
		if(!this.mode2Level.has(this.mode)) this.mode2Level.set(this.mode, 1);
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
			removeSetupDebugNotice();
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
		const composed = compose(this, maybeReload, maybeInit, notice, ()  => this.refreshTab());
		this.mode2Call = new Map(Modes.map(mode => [mode, (f:Func) => async ()  => compose(this, () => this.mode = mode, ()  => console.log('called: ', f.name), f, composed).bind(this)()]));

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

		[...this.mode2Tab.entries()].forEach(([mode,tab]) => this.register(around(tab, { display: this.overrideDisplay.bind(this, mode, tab) })));

		this.getItems = ()  => {
			switch(this.mode){
				case 'plugins': return makeArray(this.tab.containerEl.find(".installed-plugins-container").children);
				case 'snippets': return getSnippetItems(this.tab);
				default: throw new Error("Unknown mode: " + this.mode);
			}
		}

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
		// parse the JSON string into a SetArrayMap
		this.mode2DisabledStates = this.settings.disabledStates ? new Map(
			(Object.entries(JSON.parse(this.settings.disabledStates)) as JSONSetArrayMap)
				.map(([mode, states]) => [mode, states.map(state => new Set(state))])
		) : new Map();
		// parse the JSON string into a SetMap
		this.mode2Snapshot = this.settings.snapshots ? new Map(
			(Object.entries(JSON.parse(this.settings.snapshots)) as JSONSetArrayMap)
				.map(([mode, states]) => [mode, new Set(states)])
		) : new Map();
	}

	public async saveData(restore: boolean = true) {
		// convert SetArrayMap to JSON
		if (this.mode2DisabledStates) this.settings.disabledStates = JSON.stringify(Object.fromEntries(
			[...this.mode2DisabledStates.entries()].map(([mode, sets]) => [mode, [...sets].map(set => [...set])])
		));
		else this.settings.disabledStates = undefined;

		// convert SetMap to JSON
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
		console.log("addControls", this.controls, this.mode2Controls);
		this.controls.forEach(control => container.appendChild(control));
		this.controls.last().setText(`Level: ${this.mode2Level.get(this.mode)}`);
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
		if ((++this.level) === 1) { this.restore(); return; }
		const { enabled } = this.getCurrentState();
		const half = await this.disablePlugins(enabled.slice(0, Math.floor(enabled.length / 2)));
		if (half.length > 0) this.disabledState.push(new Set(half));
		else this.level--;
		return half;
	}

	public async unBisect() {
		this.level = this.level > 0 ? this.level - 1 : 0;
		const { disabled } = this.getCurrentState();
		await this.enablePlugins(disabled);
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
		await this.disablePlugins(toDisable);
		if (toDisable.length > 0) {
			this.disabledState.push(new Set(toDisable));
			this.level++;
		}
	}


	public reset() {
		this.disabledState = this.snapshot =  undefined;
		this.level = 1;
		let { enabled, disabled } = this.getCurrentStateOf(this.getIncludedPlugins() as Set<string>);
		this.disabledState = [new Set(disabled)];
		this.snapshot = new Set(disabled);
		this.saveData(false);
	}

	public async restore() {
		await this.disablePlugins(this.snapshot);
		for (let i = this.disabledState.length - 1; i >= 1; i--)
			this.enablePlugins(this.disabledState[i]);
		this.reset();
	}

	public getCurrentState() {
		const { enabled, disabled } = this.getCurrentStateOf(this.getIncludedPlugins() as Set<string>);
		this.disabledState = this.disabledState.length < 1 ? [new Set(disabled)] : this.disabledState;
		const currentDisabled = this.disabledState.last();
		return { enabled, disabled: currentDisabled };
	}

	public getCurrentStateOf(from?: Set<string>) {
		from ??= new Set(Object.keys(this.manifests));
		// sort by display name rather than id
		let included = Object.entries<PluginManifest>(this.manifests).filter(([key]) => from.has(key))
			.sort((a, b) => b[1].name.localeCompare(a[1].name))
			.map(([key, manifest]) => key);

		let result = {
			enabled: included.filter(id => this.app.plugins.enabledPlugins.has(id)),
			disabled: included.filter(id => !this.app.plugins.enabledPlugins.has(id))
		};
		return result;
	}

	public getIncludedPlugins(getPluginIds: boolean = true) {
		const plugins = (Object.values(this.manifests) as unknown as PluginManifest[]).filter(
			p => !this.settings.filterRegexes.some(
				filter => p.id.match(new RegExp(filter, "i"))
					|| (this.settings.filterUsingDisplayName && p.name.match(new RegExp(filter, "i")))
					|| (this.settings.filterUsingAuthor && p.author.match(new RegExp(filter, "i")))
					|| (this.settings.filterUsingDescription && p.description.match(new RegExp(filter, "i")))
			));
		return getPluginIds ? new Set(plugins.map(p => p.id)) : new Set(plugins);
	}

	// enables in the reverse order that they were disabled (probably not necessary, but it's nice to be consistent)
	async enablePlugins(plugins: string[] | Set<string>) {
		if (plugins instanceof Set) plugins = [...plugins];
		console.log("Enabling plugins:", plugins);
		plugins.reverse().forEach(id => this.app.plugins.enablePluginAndSave(id));
		return plugins;
	}

	async disablePlugins(plugins: string[] | Set<string>) {
		if (plugins instanceof Set) plugins = [...plugins];
		console.log("Disabling plugins:", plugins);
		for (const id of plugins) await this.app.plugins.disablePluginAndSave(id);
		return plugins;
	}

	async divideConquerSnippets(mode: string, scope?: string) {
		console.log("Mode: " + mode + ", Scope: " + scope);
		const reloadDelay = 2000;

		let noticeText;

		/** Enabled can include snippets that were removed without disabling. */
		/** This array is the list of currently loaded snippets. */
		const allSnippets = this.app.customCss.snippets;
		const enabledSnippets = allSnippets.filter((snippet) =>
			this.app.customCss.enabledSnippets.has(snippet)
		);
		const disabledSnippets = allSnippets.filter(
			(snippet) => !this.app.customCss.enabledSnippets.has(snippet)
		);

		if (mode === "count") {
			noticeText =
				"Total: " +
				allSnippets.length +
				"\nDisabled: " +
				disabledSnippets.length +
				"\nEnabled: " +
				enabledSnippets.length;
		}

		if (scope === "all") {
			if (mode === "enable") {
				for (const snippet of disabledSnippets)
					await this.app.customCss.setCssEnabledStatus(snippet, true);
			} else if (mode === "disable") {
				for (const snippet of enabledSnippets)
					await this.app.customCss.setCssEnabledStatus(snippet, false);
			} else if (mode === "toggle") {
				for (const snippet of enabledSnippets)
					await this.app.customCss.setCssEnabledStatus(snippet, false);
				for (const snippet of disabledSnippets)
					await this.app.customCss.setCssEnabledStatus(snippet, true);
			}
			noticeText =
				mode.charAt(0).toUpperCase() +
				mode.slice(1, -1) +
				"ing all " +
				allSnippets.length.toString() +
				" snippets";
		}

		if (scope === "half") {
			if (mode === "enable") {
				const disabled = disabledSnippets.length;
				const half = Math.ceil(disabled / 2);
				const halfOfDisabled = disabledSnippets.slice(0, half);

				for (const snippet of halfOfDisabled)
					await this.app.customCss.setCssEnabledStatus(snippet, true);
				noticeText = "Enabling " + half.toString() + " out of " + disabled.toString() + " disabled snippets.";

			} else if (mode === "disable") {
				const enabled = enabledSnippets.length;
				const half = Math.ceil(enabled / 2);
				const halfOfEnabled = enabledSnippets.slice(0, half);

				for (const snippet of halfOfEnabled)
					await this.app.customCss.setCssEnabledStatus(snippet, false);
				noticeText = "Disabling " + half.toString() + " out of " + enabled.toString() + " enabled snippets.";
			}
		}

		// Notify
		new Notice(noticeText);
		// no need to reload for snippets
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

	private overrideDisplay(mode:Mode, tab: SettingsTab, old: any) {
		let plugin = this;
		return (function display(...args: any[]) {
			console.log("Displaying", mode, tab, args);
			plugin.refreshTab = () => {
				plugin.mode = mode;
				console.log("Refreshing tab", plugin.mode);
				tab.reload().then(() => {
					old.apply(tab, args); // render the tab after re-loading the plugins/snippets
					plugin.addControls(); // add the controls back
					plugin.colorizeIgnoredToggles();
					// let reload = plugin.getReloadButton().pReload;
					// reload.onClickEvent = () => plugin.refreshTab();
				});
			};
			plugin.refreshTab();
		}).bind(plugin, tab);
	}


	private colorizeIgnoredToggles() {
		let name2Toggle = this.createToggleMap(this.getItems());
		let included = new Set([...(this.getIncludedPlugins(false) as Set<PluginManifest>)].map(m => m.name));

		for (let [name, toggle] of name2Toggle) {
			// if the plugin is filtered by regex settings, we indicate this visually by coloring the toggle
			if (!included.has(name)) {
				let colorToggle = () => {
					if (toggle.classList.contains('is-enabled')) toggle.style.backgroundColor = this.enabledColor;
					else toggle.style.backgroundColor = this.disabledColor;
				};
				colorToggle();
				toggle.addEventListener('click', colorToggle);
			}

			let id = Object.keys(this.manifests).filter(k => this.manifests[k].name === name).shift();
			// if the plugin is in the snapshot, we indicate this visually by outlining
			if (this.snapshot && this.snapshot.has(id)) {
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

	private wrapCall(mode:Mode, key:keyof divideAndConquer) {
		return this.wrapper(this[key] as Func);
	}



}

