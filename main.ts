import { CommunityPluginsTab, ExtraButtonComponent, Notice, Plugin, PluginManifest } from "obsidian";
import { DACSettingsTab, DEFAULT_SETTINGS } from "settings";
import { compose, removeSetupDebugNotice, simpleCalc } from './util';

import { around } from 'monkey-around';

var tinycolor = require("tinycolor2");




export default class divideAndConquer extends Plugin {
	settings: typeof DEFAULT_SETTINGS;
	manifests = this.app.plugins.manifests;

	level = 1;
	levelEl = this.getLevelText();
	controlElements: HTMLElement[] = null;
	enabledColor: string = null;
	disabledColor: string = null;
	composed: (func: () => any) => () => any;
	refreshPlugins: () => void = () => { };
	disabledState: Set<string>[];
	snapshot: Set<string>;

	async onunload() {
		this.saveData();
		console.log("Divide & Conquer Plugin unloaded.");
	}

	async onload() {
		this.loadData();
		console.log("Divide & Conquer Plugin loaded.");

		const notice = () => {
			removeSetupDebugNotice();
			let notic_str = `DAC level:${this.level} `;
			if (this.level === 1) new Notice(notic_str + "- Now in the original state");
			else if (this.level === 0) new Notice(notic_str + "- All Plugins Enabled");
			else new Notice(notic_str);
		};

		const maybeReload = () => {
			if (this.settings.reloadAfterPluginChanges) setTimeout(() => this.app.commands.executeCommandById("app:reload"), 2000); 
		};

		const maybeInit = () => {
			if (this.settings.initializeAfterPluginChanges) return this.app.plugins.initialize();
		};

		this.composed = (func: () => any) => async () => compose(this, func, this.refreshPlugins, maybeReload, maybeInit, notice).bind(this)();
		const composed = this.composed;

		await this.loadData();
		this.addSettingTab(new DACSettingsTab(this.app, this));

		this.addCommand({
			id: "bisect",
			name: "Bisect - Disable half of the active plugins, or return to the original state if all plugins are active",
			callback: composed(this.bisect)
		});

		this.addCommand({
			id: "un-bisect",
			name: "Un-Bisect - Undo the last bisection, or enable all plugins if in the original state",
			callback: composed(this.unBisect)
		});

		this.addCommand({
			id: "re-bisect",
			name: "Re-Bisect - Undo the last bisection, then disable the other half",
			callback: composed(this.reBisect)
		});

		this.addCommand({
			id: "reset",
			name: "Reset - forget the original state and set the current state as the new original state",
			callback: composed(this.reset)
		});

		this.addCommand({
			id: "restore",
			name: "Restore - return to the original state",
			callback: composed(this.restore)
		});

		this.addCommand({
			id: "count-enabled-and-disabled-snippets",
			name: "Count enabled and disabled snippets",
			callback: () => this.divideConquerSnippets("count"),
		});

		this.addCommand({
			id: "disable-all-snippets",
			name: "Disable all snippets",
			callback: () => this.divideConquerSnippets("disable", "all"),
		});

		this.addCommand({
			id: "enable-all-snippets",
			name: "Enable all snippets",
			callback: () => this.divideConquerSnippets("enable", "all"),
		});

		this.addCommand({
			id: "toggle-all-snippets",
			name: "Toggle all plugins (Disable enabled snippets & enable disabled ones)",
			callback: () => this.divideConquerSnippets("toggle", "all"),
		});

		this.addCommand({
			id: "disable-half-snippets",
			name: "Disable half of enabled snippets",
			callback: () => this.divideConquerSnippets("disable", "half"),
		});

		this.addCommand({
			id: "enable-half-snippets",
			name: "Enable half of disabled snippets",
			callback: () => this.divideConquerSnippets("enable", "half"),
		});

		this.app.workspace.onLayoutReady(() => {
			let appContainer = document.getElementsByClassName("app-container").item(0) as HTMLDivElement;
			this.enabledColor ??= tinycolor(simpleCalc(appContainer.getCssPropertyValue('--checkbox-color'))).spin(180).toHexString();
			this.disabledColor ??= tinycolor(this.enabledColor).darken(35).toHexString();
		});
		
		// override the display of the community plugins tab to add controls
		const community: CommunityPluginsTab = this.getSettingsTab("community-plugins");
		if (community) this.register(around(community, { display: this.overrideDisplay.bind(this, community) }));
	}

	public async loadData() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await super.loadData());
		this.disabledState = this.settings.disabledState ?
			JSON.parse(this.settings.disabledState).map((set: string[]) => new Set(set))
			: undefined;
		this.snapshot = this.settings.snapshot ? new Set(JSON.parse(this.settings.snapshot)) : undefined;
	}

	public async saveData(restore: boolean = true) {
		if (this.disabledState?.length > 0)
			this.settings.disabledState = JSON.stringify(this.disabledState.map(set => [...set]));
		else this.settings.disabledState = undefined;
		if (this.snapshot) this.settings.snapshot = JSON.stringify([...this.snapshot]);
		else this.settings.snapshot = undefined;
		if (restore) await this.restore();
		await super.saveData(this.settings);
	}

	async bisect() {
		if ((++this.level) === 1) { this.restore(); return; }
		const { enabled } = this.getCurrentEDPs();
		const half = await this.disablePlugins(enabled.slice(0, Math.floor(enabled.length / 2)));
		if (half.length > 0) this.disabledState.push(new Set(half));
		else this.level--;
		return half;
	}

	public async unBisect() {
		this.level = this.level > 0 ? this.level - 1 : 0;
		const { disabled } = this.getCurrentEDPs();
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
		const { enabled } = this.getCurrentEDPs();
		const toDisable = enabled.filter(id => !reenabled.has(id));
		await this.disablePlugins(toDisable);
		if (toDisable.length > 0) {
			this.disabledState.push(new Set(toDisable));
			this.level++;
		}
	}


	public reset() {
		this.disabledState = this.settings.disabledState = this.snapshot = this.settings.snapshot = undefined;
		this.level = 1;
		let { enabled, disabled } = this.getVaultEDPsFrom(this.getIncludedPlugins() as Set<string>);
		this.disabledState = [new Set(disabled)];
		this.snapshot = new Set(disabled);
		this.saveData(false);
	}

	public async restore() {
		if (!this.disabledState) return;
		for (let i = this.disabledState.length - 1; i >= 1; i--)
			this.enablePlugins(this.disabledState[i]);
		console.log(this.snapshot);
		await this.disablePlugins(this.snapshot);
		this.reset();
	}

	// EDPs = Enabled/Disabled Plugins
	public getCurrentEDPs() {
		const { enabled, disabled } = this.getVaultEDPsFrom(this.getIncludedPlugins() as Set<string>);
		this.disabledState ??= [new Set(disabled)];
		const currentDisabled = this.disabledState.last();
		return { enabled, disabled: currentDisabled };
	}

	// EDPs = Enabled/Disabled Plugins
	public getVaultEDPsFrom(from?: Set<string>) {
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
		plugins.reverse().forEach(id => this.app.plugins.enablePluginAndSave(id));
		return plugins;
	}

	async disablePlugins(plugins: string[] | Set<string>) {
		if (plugins instanceof Set) plugins = [...plugins];
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

	getLevelText() {
		let span = document.createElement("span");
		span.setText(`Level: ${this.level}`);
		return span;
	}

	getControlContainer() {
		return this.getSettingsTab("community-plugins").containerEl.find(".setting-item-heading").find(".setting-item-control") as HTMLDivElement;
	}

	getInstalledPluginsContainer() {
		return this.getSettingsTab("community-plugins").containerEl.find(".installed-plugins-container") as HTMLDivElement;
	}

	getReloadButton() {
		return this.getControlContainer().find('[aria-label="Reload plugins"]') as HTMLDivElement;
	}

	getSettingsTab(id: string) {
		return this.app.setting.settingTabs.filter(t => t.id === id).shift();
	}

	overrideDisplay(community: CommunityPluginsTab, old: any) {
		let plugin = this;
		return (function display(...args: any[]) {
			plugin.refreshPlugins = () => {
				plugin.app.plugins.loadManifests().then(() => {
					old.apply(community, args); // render the community plugin tab after re-loading the manifests
					plugin.addControls(); // add the controls back
					plugin.colorizeIgnoredToggles();
				});
			};
			plugin.refreshPlugins();
		}).bind(plugin, community);
	}


	colorizeIgnoredToggles() {
		let container = this.getInstalledPluginsContainer();
		let name2Toggle = new Map<string, HTMLDivElement>();
		for (var i = 0; i < container.children.length; i++) {
			let child = container.children[i];
			let name = (child.querySelector(".setting-item-name") as HTMLDivElement).innerText;
			let toggle = (child.querySelector(".setting-item-control")).querySelector('.checkbox-container') as HTMLDivElement;
			if (name && toggle) name2Toggle.set(name, toggle);
		}

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

			// console.log(this.manifests);
			let id = Object.keys(this.manifests).filter(k => this.manifests[k].name === name).shift();
			// if the plugin is in the snapshot, we indicate this visually by setting outline-offset: 1px; and outline: outset;
			if (this.snapshot && this.snapshot.has(id)) {
				toggle.style.outlineOffset = "1px";
				toggle.style.outline = "outset";
			}
		}

	}

	addControls() {
		let container = this.getControlContainer(), composed = this.composed;
		this.controlElements ??= [
			new ExtraButtonComponent(container)
				.setIcon("camera")
				.setTooltip("Reset - Snapshot the current state")
				.onClick(composed(this.reset))
				.setDisabled(false).extraSettingsEl,

			new ExtraButtonComponent(container)
				.setIcon("switch-camera")
				.setTooltip("Restore - Restore Snapshot")
				.onClick(composed(this.restore))
				.setDisabled(false).extraSettingsEl,

			new ExtraButtonComponent(container)
				.setIcon("expand")
				.setTooltip("UnBisect - Go up a level")
				.onClick(composed(this.unBisect))
				.setDisabled(false).extraSettingsEl,

			new ExtraButtonComponent(container)
				.setIcon("minimize")
				.setTooltip("Bisect - Go down a level")
				.onClick(composed(this.bisect))
				.setDisabled(false).extraSettingsEl,

			new ExtraButtonComponent(container)
				.setIcon("flip-vertical")
				.setTooltip("Re-bisect - Go back a level, then down the other side")
				.onClick(composed(this.reBisect))
				.setDisabled(false).extraSettingsEl,

			this.levelEl,
		];
		this.levelEl.setText(`Level: ${this.level}`);
		this.controlElements.forEach(button => container.appendChild(button));
		return container;
	}

}
