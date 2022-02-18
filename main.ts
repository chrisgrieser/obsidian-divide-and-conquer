import { Plugin, Notice } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: string[];
			disablePluginAndSave: (id: string) => Promise<boolean>;
			enablePluginAndSave: (id: string) => Promise<boolean>;
		};
		commands: {
			executeCommandById: (commandID: string) => void;
		}

        customCss: {
            enabledSnippets: Set<string>;
            snippets: string[];
            setCssEnabledStatus(snippet: string, enable: boolean): void;
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

		/** Snippet Commands */
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

	async divideConquer (mode: string, scope?: string) {
		console.log ("Mode: " + mode + ", Scope: " + scope);
		const reloadDelay = 2000;
		const pluginsToIgnore = [
			"hot-reload",
			"obsidian-divide-and-conquer"
		];


		const tplugins = this.app.plugins;
		let noticeText;

		const allPlugins = Object.keys(tplugins.manifests).filter (id => !pluginsToIgnore.includes(id));
		const enabledPlugins = Object.keys(tplugins.plugins).filter (id => !pluginsToIgnore.includes(id));
		const disabledPlugins = allPlugins.filter (id => !enabledPlugins.includes(id));

		if (mode === "count") {
			noticeText =
				"Total: " + allPlugins.length
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
			noticeText = mode.charAt(0).toUpperCase() + mode.slice(1, -1) + "ing all " + allPlugins.length.toString() + " plugins";
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
