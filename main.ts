import { Plugin, Notice } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: string[];
			disablePluginAndSave: (id: string) => void;
			enablePluginAndSave: (id: string) => void;
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

	divideConquer (mode: string, scope?: string) {
		console.log ("Mode: " + mode + ", Scope: " + scope);
		const reloadDelay = 2000;
		let noticeText;

		const allPlugins = Object.keys(this.app.plugins.manifests)
			.filter (id => id !== "obsidian-divide-and-conquer");
		const enabledPlugins = Object.keys(this.app.plugins.plugins)
			.filter (id => id !== "obsidian-divide-and-conquer");
		const disabledPlugins = allPlugins
			.filter (id => !enabledPlugins.includes(id));

		if (mode === "count") {
			noticeText =
				"Total: " + allPlugins.length
				+ "\nDisabled: " + disabledPlugins.length
				+ "\nEnabled: " + enabledPlugins.length;
		}

		if (scope === "all") {
			if (mode === "enable") {
				allPlugins.forEach (id => this.app.plugins.enablePluginAndSave(id));
			} else if (mode === "disable") {
				allPlugins.forEach (id => this.app.plugins.disablePluginAndSave(id));
			} else if (mode === "toggle") {
				enabledPlugins.forEach (id => this.app.plugins.disablePluginAndSave(id));
				disabledPlugins.forEach (id => this.app.plugins.enablePluginAndSave(id));
			}
			noticeText = mode.charAt(0).toUpperCase() + mode.slice(1, -1) + "ing all " + allPlugins.length.toString() + " plugins";
		}

		if (scope === "half") {
			if (mode === "enable") {
				const disabled = disabledPlugins.length;
				const half = Math.ceil(disabled / 2);

				disabledPlugins
					.slice (0, half)
					.forEach (id => this.app.plugins.enablePluginAndSave(id));

				noticeText = "Enabling " + half.toString() + " out of " + disabled.toString() + " disabled plugins.";

			} else if (mode === "disable") {
				const enabled = enabledPlugins.length;
				const half = Math.ceil(enabled / 2);

				enabledPlugins
					.slice (0, half)
					.forEach (id => this.app.plugins.disablePluginAndSave(id));

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


}
