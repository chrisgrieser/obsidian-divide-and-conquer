import { DACSettingsTab, DEFAULT_SETTINGS } from "settings";
import { Notice, Plugin, PluginManifest } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: PluginManifest[];
			enabledPlugins: Set<string>;
			disablePluginAndSave: (id: string) => Promise<boolean>;
			enablePluginAndSave: (id: string) => Promise<boolean>;
		};
		commands: {
			executeCommandById: (commandID: string) => void;

		};
		customCss: {
			enabledSnippets: Set<string>;
			snippets: string[];
			setCssEnabledStatus(snippet: string, enable: boolean): void;
		};

	}
}


export default class divideAndConquer extends Plugin {
	settings: typeof DEFAULT_SETTINGS;
	disabledState: Set<string>[];
	manifests = this.app.plugins.manifests;
	steps = 1;

	async onunload() {
		this.saveData();
		console.log("Divide & Conquer Plugin unloaded.");
	}

	async onload() {
		this.loadData();
		console.log("Divide & Conquer Plugin loaded.");

		let maybeReload = () => {
			if (this.settings.reloadAfterPluginChanges) // TODO: timeout isn't the best way to do this
				setTimeout(() => this.app.commands.executeCommandById("app:reload"), 2000); // eslint-disable-line no-magic-numbers
		};

		const notice = () => {
			if (this.steps === 1) new Notice("DAC: Now in the original state.");
			if (this.steps === 0) new Notice("DAC: All Plugins Enabled");
		};

		// compose takes any number of functions, binds them to "this", and returns a function that calls them in order
		let compose = (...funcs: Function[]) => (...args: any[]) =>
			funcs.reduce((promise, func) => promise.then(func.bind(this)), Promise.resolve());
		const composed = (func: () => any) => async () => compose(func, maybeReload, notice).bind(this)();


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
	}

	public async loadData() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await super.loadData());
		this.disabledState = this.settings.disabledState ?
			JSON.parse(this.settings.disabledState).map((set: string[]) => new Set(set))
			: undefined;
	}

	public async saveData(restore: boolean = true) {
		if (this.disabledState?.length > 0)
			this.settings.disabledState = JSON.stringify(this.disabledState.map(set => [...set]));
		else this.settings.disabledState = undefined;
		if (restore) await this.restore();
		await super.saveData(this.settings);
	}

	async bisect() {
		if ((++this.steps) === 1) { this.restore(); return; }
		const { enabled } = this.getCurrentEDPs();
		const half = await this.disablePlugins(enabled.slice(0, Math.floor(enabled.length / 2)));
		if (half.length > 0) this.disabledState.push(new Set(half));
		return half;
	}

	public async unBisect() {
		this.steps = this.steps > 0 ? this.steps - 1 : 0;
		const { disabled } = this.getCurrentEDPs();
		await this.enablePlugins(disabled);
		// this allows unbisect to turn on all plugins without losing the original state
		if (this.disabledState.length > 1) return this.disabledState.pop();
		return new Set();
	}

	public async reBisect() {
		if (this.steps < 2) {
			new Notice("Cannot re-bisect the original state.");
			return;
		}
		const reenabled = await this.unBisect();
		const { enabled } = this.getCurrentEDPs();
		const toDisable = enabled.filter(id => !reenabled.has(id));
		await this.disablePlugins(toDisable);
		if (toDisable.length > 0) this.disabledState.push(new Set(toDisable));
	}


	public reset() {
		this.disabledState = this.settings.disabledState = undefined;
		this.steps = 1;
		// we don't need to set the original state here because it is lazily created
	}

	public async restore() {
		if (this.disabledState === null) return;
		for (let i = this.disabledState.length - 1; i >= 1; i--)
			this.enablePlugins(this.disabledState[i]);
		await this.disablePlugins(this.disabledState[0]);
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

		return {
			enabled: included.filter(id => this.app.plugins.enabledPlugins.has(id)),
			disabled: included.filter(id => !this.app.plugins.enabledPlugins.has(id))
		};
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
	async divideConquerSnippets (mode: string, scope?: string) {
		console.log ("Mode: " + mode + ", Scope: " + scope);
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
				const halfOfDisabled = disabledSnippets.slice (0, half);

				for (const snippet of halfOfDisabled)
					await this.app.customCss.setCssEnabledStatus(snippet, true);
				noticeText = "Enabling " + half.toString() + " out of " + disabled.toString() + " disabled snippets.";

			} else if (mode === "disable") {
				const enabled = enabledSnippets.length;
				const half = Math.ceil(enabled / 2);
				const halfOfEnabled = enabledSnippets.slice (0, half);

				for (const snippet of halfOfEnabled)
					await this.app.customCss.setCssEnabledStatus(snippet, false);
				noticeText = "Disabling " + half.toString() + " out of " + enabled.toString() + " enabled snippets.";
			}
		}

		// Notify
		new Notice (noticeText);

		// no need to reload for snippets

	}


}
