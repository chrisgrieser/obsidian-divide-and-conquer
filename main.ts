import { Plugin, Notice } from "obsidian";

export default class footnoteIndicator extends Plugin {

	async onunload() { console.log("Divide & Conquer Plugin unloaded.") }

	async onload() {
		console.log("Divide & Conquer Plugin loaded.");

		this.addCommand({
			id: "disable-all-plugins",
			name: "Test Notice",
			callback: () => new Notice ("I am a test notice. 👋 \n\nI will stay here until you click me.", 0),
		});

		this.addCommand({
			id: "cycle-views",
			name: "Cycle between Source Mode, Live Preview, and Reading Mode",
			callback: () => this.cycleViews(),
		});

	}

	// - disable all
	// - enable all
	// - disable half of enabled
	// - enable half of disabled
	// - switch disabled and enabled


}
