import { PluginManifest } from "obsidian";

declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: {[id:string]:PluginManifest};
			enabledPlugins: Set<string>;
			disablePluginAndSave: (id: string) => Promise<boolean>;
			enablePluginAndSave: (id: string) => Promise<boolean>;
			initialize: () => Promise<void>;
			loadManifests: () => Promise<void>;
		};
		commands: {
			executeCommandById: (commandID: string) => void;
		};
		customCss: {
			enabledSnippets: Set<string>;
			snippets: string[];
			setCssEnabledStatus(snippet: string, enable: boolean): void;
			loadSnippets(): Promise<void>;
		};
		setting: {
			settingTabs: {id:string, containerEl:HTMLElement}[];
		}
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

    interface SettingsTab {
        containerEl: HTMLElement;
        navEl: HTMLElement;
        display(...args: any[]): void;
        hide(): any;
		reload(): Promise<void>;
		heading:string;
		reloadLabel: string;
    }
}