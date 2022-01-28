import { Plugin, Notice } from "obsidian";

export default class footnoteIndicator extends Plugin {

	async onunload() { console.log("Divide & Conquer Plugin unloaded.") }

	async onload() {
		console.log("Divide & Conquer Plugin loaded.");

		this.addCommand({
			id: "disable-all",
			name: "Disable all plugins",
			callback: () => this.divideConquer("disable-all"),
		});

		this.addCommand({
			id: "enable-all",
			name: "Enable all plugin",
			callback: () => this.divideConquer("enable-all",
		});

		this.addCommand({
			id: "toggle-all",
			name: "Toggle all plugins (Disable enabled plugins & enable disabled ones)",
			callback: () => this.divideConquer("toggle-all"),
		});

		this.addCommand({
			id: "disable-half",
			name: "Disable half of the enabled plugins",
			callback: () => this.divideConquer("disable-half"),
		});

		this.addCommand({
			id: "enable-half",
			name: "Enable half of the disabled plugins",
			callback: () => this.divideConquer("enable-half"),
		});

	}

	divideConquer (string: mode) {
		console.log (mode);
	}


}
