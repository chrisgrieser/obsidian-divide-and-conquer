import { App, PluginManifest, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";

import divideAndConquer from "main";

export interface DACSettings {
	omittedPlugins: string[];
    filterUsingDisplayName: boolean,
    filterUsingAuthor: boolean,
    filterUsingDescription: boolean,
}

export const DEFAULT_SETTINGS: DACSettings = {
	omittedPlugins: [
        "hot-reload",
        "obsidian-divide-and-conquer"
    ],
    filterUsingDisplayName: true,
    filterUsingAuthor: false,
    filterUsingDescription: false,
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

        new Setting(containerEl)
        .setName('Use Filters on Plugin Display Names')
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



        let inputArea : TextAreaComponent;
        let exclude = new Setting(containerEl)
            .setName('Plugin Exclusions')
            .setDesc('Exclude plugins using regex (case insensitive).\nEach new line is a new regex. Plugin ids are used for matching by default. Included plugins are on the left, excluded on the right. ')
            .addTextArea ((textArea) => {
                inputArea = textArea;
                textArea.inputEl.setAttr('rows',10);
                textArea.inputEl.style.width ='45%';
                textArea.setPlaceholder(this.plugin.getIncludedPlugins().map(p => p.name).join('\n')).setDisabled(true);
            });
            exclude.addTextArea((textArea) => {
                textArea.inputEl.setAttr('rows', 10);
                textArea.inputEl.style.width ='55%'
                textArea
                    .setPlaceholder('^daily/\n\\.png$\netc...')
                    .setValue(this.plugin.settings.omittedPlugins.join('\n'));
                textArea.inputEl.onblur = (e: FocusEvent) => {
                    const patterns = (e.target as HTMLInputElement).value;
                    this.plugin.settings.omittedPlugins = patterns.split('\n').filter(p => p.length);
                    this.plugin.saveData();
                    inputArea.setPlaceholder(this.plugin.getIncludedPlugins().map(p => p.name).join('\n')).setDisabled(true);
                };
            });
            exclude.controlEl.style.width ='100%';
            exclude.infoEl.style.width ='45%';


    }


}