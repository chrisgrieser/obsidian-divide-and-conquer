import { Plugin, Notice } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins?: () => Set<string>;
			manifests: () => string[];
			disablePluginAndSave: (pluginID: string) => void;
			enablePluginAndSave: (pluginID: string) => void;
		};
		commands: {
			executeCommandById: (commandID: string) => void;
		}
	}
}


export default class divideAndConquer extends Plugin {

	async onunload() { console.log("Divide & Conquer Plugin unloaded.") }

	async onload() {
		console.log("Divide & Conquer Plugin loaded.");

		this.addCommand({
			id: "disable-all",
			name: "Disable all plugins",
			callback: () => this.divideConquer("disable", "all"),
		});

		this.addCommand({
			id: "enable-all",
			name: "Enable all plugin",
			callback: () => this.divideConquer("enable", "all"),
		});

		this.addCommand({
			id: "toggle-all",
			name: "Toggle all plugins (Disable enabled plugins & enable disabled ones)",
			callback: () => this.divideConquer("toggle", "all"),
		});

		this.addCommand({
			id: "disable-half",
			name: "Disable half of the enabled plugins",
			callback: () => this.divideConquer("disable", "half"),
		});

		this.addCommand({
			id: "enable-half",
			name: "Enable half of the disabled plugins",
			callback: () => this.divideConquer("enable", "half"),
		});

	}

	divideConquer (mode: string, scope: string) {
		console.log ("Mode: " + mode + ", Scope: " + scope);

		// get pluginIDs of all installed plugins
		const comPlugin = Object.keys(this.app.plugins.manifests)
			.filter (f => f !== "obsidian-divide-and-conquer");


		if () {
			comPlugin.forEach (pluginID => this.app.plugins.enablePluginAndSave(pluginID));
			new Notice ("Enabling " + comPlugin.length.toString() + " plugins");
		} else {
			comPlugin.forEach (pluginID => this.app.plugins.disablePluginAndSave(pluginID));
			new Notice ("Disabling " + comPlugin.length.toString() + " plugins");
		}

		if (mode !== "enable") {
			setTimeout(() => {
				this.app.commands.executeCommandById("app:reload");
			}, 2000); // eslint-disable-line no-magic-numbers
		}
	}


}
