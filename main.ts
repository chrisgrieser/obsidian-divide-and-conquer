import { DACSettingsTab, DEFAULT_SETTINGS } from "settings";
import { Notice, Plugin, PluginManifest } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: string[];
			enabledPlugins: string[];
			disablePluginAndSave: (id: string) => Promise<boolean>;
			enablePluginAndSave: (id: string) => Promise<boolean>;
		};
		commands: {
			executeCommandById: (commandID: string) => void;
		}
	}
}



export default class divideAndConquer extends Plugin {
	settings : typeof DEFAULT_SETTINGS;
		
	async onunload() { console.log("Divide & Conquer Plugin unloaded.") }

	async onload() {
		console.log("Divide & Conquer Plugin loaded.");

		await this.loadData();
		this.addSettingTab(new DACSettingsTab(this.app, this));

		this.addCommand({
			id: "count-enabled-and-disabled",
			name: "Count enabled and disabled plugins",
			callback: () => this.divideConquer("count"),
		});

		this.addCommand({
			id: "disable-all",
			name: "Disable all plugins",
			callback: () => this.divideConquer("disable", "all"),
		});

		this.addCommand({
			id: "enable-all",
			name: "Enable all plugins",
			callback: () => this.divideConquer("enable", "all"),
		});

		this.addCommand({
			id: "toggle-all",
			name: "Toggle all plugins (Disable enabled plugins & enable disabled ones)",
			callback: () => this.divideConquer("toggle", "all"),
		});

		this.addCommand({
			id: "disable-half",
			name: "Disable half of enabled plugins",
			callback: () => this.divideConquer("disable", "half"),
		});

		this.addCommand({
			id: "enable-half",
			name: "Enable half of disabled plugins",
			callback: () => this.divideConquer("enable", "half"),
		});

	}

	async divideConquer (mode: string, scope?: string) {
		console.log ("Mode: " + mode + ", Scope: " + scope);
		const reloadDelay = 2000;
		
		const tplugins = this.app.plugins;
		let noticeText;

		const includedPlugins = this.getIncludedPlugins().map(p => p.id);
		const enabledPlugins = Object.keys(this.app.plugins.plugins).filter(p => includedPlugins.includes(p));
		const disabledPlugins = includedPlugins.filter (id => !enabledPlugins.includes(id));

		if (mode === "count") {
			noticeText =
				"Total: " + includedPlugins.length
				+ "\nDisabled: " + disabledPlugins.length
				+ "\nEnabled: " + enabledPlugins.length;
		}

		if (scope === "all") {
			if (mode === "enable") {
				for (const id of disabledPlugins) await tplugins.enablePluginAndSave(id);
			} else if (mode === "disable") {
				for (const id of enabledPlugins) await tplugins.disablePluginAndSave(id);
			} else if (mode === "toggle") {
				for (const id of enabledPlugins) await tplugins.disablePluginAndSave(id);
				for (const id of disabledPlugins) await tplugins.enablePluginAndSave(id);
			}
			noticeText = mode.charAt(0).toUpperCase() + mode.slice(1, -1) + "ing all " + includedPlugins.length.toString() + " plugins";
		}

		if (scope === "half") {
			if (mode === "enable") {
				const disabled = disabledPlugins.length;
				const half = Math.ceil(disabled / 2);
				const halfOfDisabled = disabledPlugins.slice (0, half);

				for (const id of halfOfDisabled) await tplugins.enablePluginAndSave(id);
				noticeText = "Enabling " + half.toString() + " out of " + disabled.toString() + " disabled plugins.";

			} else if (mode === "disable") {
				const enabled = enabledPlugins.length;
				const half = Math.ceil(enabled / 2);
				const halfOfEnabled = enabledPlugins.slice (0, half);

				for (const id of halfOfEnabled) await tplugins.disablePluginAndSave(id);
				noticeText = "Disabling " + half.toString() + " out of " + enabled.toString() + " enabled plugins.";
			}
		}

		// Notify & reload
		const reloadAfterwards = (mode === "toggle" || mode === "disable");
		if (reloadAfterwards) noticeText += "\n\nReloading Obsidian...";
		new Notice (noticeText);

		if (reloadAfterwards) {
			setTimeout(() => {
				this.app.commands.executeCommandById("app:reload");
			}, reloadDelay);
		}
	}

	public async loadData() {this.settings = Object.assign({}, DEFAULT_SETTINGS, await super.loadData());}
	public async saveData() { await super.saveData(this.settings); }
	
	public getIncludedPlugins(){
		return (Object.values(this.app.plugins.manifests) as unknown as PluginManifest[]).filter(
			p => !this.settings.omittedPlugins.some(
				ignore => p.id.match(new RegExp(ignore, "i")) 
				|| (this.settings.filterUsingDisplayName && p.name.match(new RegExp(ignore, "i")))
				|| (this.settings.filterUsingAuthor && p.author.match(new RegExp(ignore, "i")))
				|| (this.settings.filterUsingDescription && p.description.match(new RegExp(ignore, "i")))
				)
		);
	}

}
