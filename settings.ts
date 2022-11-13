import { App, PluginManifest, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";

import divideAndConquer from "main";

export interface DACSettings {
    pluginFilterRegexes: string[];
    snippetFilterRegexes: string[];
    filterUsingDisplayName: boolean,
    filterUsingAuthor: boolean,
    filterUsingDescription: boolean,
    initializeAfterPluginChanges: boolean,
    reloadAfterPluginChanges: boolean,
    disabledStates: string;
    snapshots: string;
}

export const DEFAULT_SETTINGS: DACSettings = {
    pluginFilterRegexes: [
        "hot-reload",
        "obsidian-divide-and-conquer"
    ],
    snippetFilterRegexes: [],
    filterUsingDisplayName: true,
    filterUsingAuthor: false,
    filterUsingDescription: false,
    initializeAfterPluginChanges: false,
    reloadAfterPluginChanges: false,
    disabledStates: undefined,
    snapshots: undefined,
};


export class DACSettingsTab extends PluginSettingTab {
    plugin: divideAndConquer;

    constructor(app: App, plugin: divideAndConquer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    public display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Divide and Conquer' });
        containerEl.createEl('p', { text: 'Note: Reinitializing or Reloading may cause disabled plugins to dissappear, close and open the menu to see them again' });

        new Setting(containerEl)
            .setName('Reinitialize Obsidian after plugin changes')
            .setDesc('this is sometimes necessary, and shows setup times if you have "Debug startup time" enabled in the Community Plugins tab')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.initializeAfterPluginChanges)
                    .onChange(async (value) => {
                        this.plugin.settings.initializeAfterPluginChanges = value;
                        await this.plugin.saveData(false);
                    })
            );

            new Setting(containerEl)
            .setName('Reload Obsidian after plugin changes')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.reloadAfterPluginChanges)
                    .onChange(async (value) => {
                        this.plugin.settings.reloadAfterPluginChanges = value;
                        await this.plugin.saveData(false);
                    })
            );

        containerEl.createEl('p', { text: 'Changing any of the following settings will restore plugins to the original state.' });


        new Setting(containerEl)
            .setName('Use Filters on Plugin Display Names')
            .setDesc('If this is off, DAC will only match plugins by their ID')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.filterUsingDisplayName)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingDisplayName = value;
                        await this.plugin.saveData();
                    })
            );

        new Setting(containerEl)
            .setName('Use Filters on Plugin Authors')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.filterUsingAuthor)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingAuthor = value;
                        await this.plugin.saveData();
                    })
            );

        new Setting(containerEl)
            .setName('Use Filters on Plugin Descriptions')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.filterUsingDescription)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingDescription = value;
                        await this.plugin.saveData();
                    })
            );



        let inputArea: TextAreaComponent;
        let exclude = new Setting(containerEl)
            .setName('Plugin Exclusions')
            .setDesc('Exclude plugins using regex (case insensitive).\nEach new line is a new regex. Plugin ids are used for matching by default. Included plugins are on the left, excluded on the right. ')
            .addTextArea((textArea) => {
                inputArea = textArea;
                textArea.inputEl.setAttr('rows', 10);
                textArea.inputEl.style.width = '45%';
                textArea.setPlaceholder(
                    [...(this.plugin.getIncludedItems('plugins'))]
                        .map(p => p.name).join('\n')
                ).setDisabled(true);
            });
        exclude.addTextArea((textArea) => {
            textArea.inputEl.setAttr('rows', 10);
            textArea.inputEl.style.width = '55%';
            textArea
                .setPlaceholder('^daily/\n\\.png$\netc...')
                .setValue(this.plugin.settings.pluginFilterRegexes.join('\n'));
            textArea.inputEl.onblur = (e: FocusEvent) => {
                const patterns = (e.target as HTMLInputElement).value;
                this.plugin.settings.pluginFilterRegexes = patterns.split('\n').filter(p => p.length);
                this.plugin.saveData();
                inputArea.setPlaceholder(
                    [...(this.plugin.getIncludedItems('plugins'))].map(p => p.name).join('\n')
                ).setDisabled(true);
            };
        });
        exclude.controlEl.style.width = '100%';
        exclude.infoEl.style.width = '45%';

        let inputArea2: TextAreaComponent;

        let exclude2 = new Setting(containerEl)
            .setName('Snippet Exclusions')
            .setDesc('Exclude snippets using regex (case insensitive).\nEach new line is a new regex. Snippet are only exclude by their name.')
            .addTextArea((textArea) => {
                inputArea2 = textArea;
                textArea.inputEl.setAttr('rows', 10);
                textArea.inputEl.style.width = '45%';
                textArea.setPlaceholder(
                    [...(this.plugin.getIncludedItems('snippets'))].map(p => p.name).join('\n')
                ).setDisabled(true);
            });
        exclude2.addTextArea((textArea) => {
            textArea.inputEl.setAttr('rows', 10);
            textArea.inputEl.style.width = '55%';
            textArea
                .setPlaceholder('^daily/\n\\.png$\netc...')
                .setValue(this.plugin.settings.snippetFilterRegexes.join('\n'));
            textArea.inputEl.onblur = (e: FocusEvent) => {
                const patterns = (e.target as HTMLInputElement).value;
                this.plugin.settings.snippetFilterRegexes = patterns.split('\n').filter(p => p.length);
                this.plugin.saveData();
                inputArea2.setPlaceholder(
                    [...(this.plugin.getIncludedItems('snippets'))].map(p => p.name).join('\n')
                ).setDisabled(true);
            };
        });
        
        exclude2.controlEl.style.width = '100%';
        exclude2.infoEl.style.width = '45%';
    }


}