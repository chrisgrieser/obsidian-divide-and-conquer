import { PluginManifest } from "obsidian";

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
	}
	interface View {
		renderer: {
			worker: Worker,
			autoRestored: boolean,
			nodes: any[],
		};
		dataEngine: Engine;
		engine: Engine;
	}

	interface Engine {
		displayOptions: any,
		forceOptions: {
			optionListeners: {
				centerStrength: (value: number) => void,
				linkDistance: (value: number) => void,
				linkStrength: (value: number) => void,
				repelStrength: (value: number) => void,
			},
		},
	}

    interface CommunityPluginsTab {
        installedPluginsEl: HTMLElement;
        containerEl: HTMLElement;
        navEl: HTMLElement;
        display(...args: any[]): void;
        hide(): any;
    }
}