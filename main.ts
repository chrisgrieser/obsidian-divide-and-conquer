import { Plugin } from "obsidian";

export default class footnoteIndicator extends Plugin {

	async onload() { console.log("Footnote Indicator Plugin loaded.") }

	async onunload() { console.log("Footnote Indicator Plugin unloaded.") }

}
