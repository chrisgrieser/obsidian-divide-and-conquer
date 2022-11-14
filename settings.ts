import { App, PluginManifest, PluginSettingTab, Setting, TextAreaComponent, ToggleComponent } from "obsidian";

import type { Mode } from "./util";
import { around } from 'monkey-around';
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

interface  TextAreaArgs { mode: Mode, container: Setting, placeholder?: string, value?: string, disabledArea?:TextAreaComponent }    

export class DACSettingsTab extends PluginSettingTab {
    plugin: divideAndConquer;
    toggles: ToggleComponent[] = [];
    constructor(app: App, plugin: divideAndConquer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    public display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h1', { text: 'Divide and Conquer' });
        containerEl.createEl('h5', {
            text: 'Note: Reinitializing or Reloading may cause disabled plugins to dissappear; close and open the menu to see them again'
            // set the color to the computed value of --interactive-accent
        }).style.color = getComputedStyle(containerEl).getPropertyValue('--interactive-accent');

        new Setting(containerEl)
            .setName('Reinitialize Obsidian after plugin changes')
            .setDesc('This is not usually necessary. If you have "Debug startup time" enabled in the Community Plugins tab you\'ll see startup times when using commmands')
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.initializeAfterPluginChanges)
                    .onChange(async (value) => {
                        this.plugin.settings.initializeAfterPluginChanges = value;
                        await this.plugin.saveData(false);
                    })
            );

        new Setting(containerEl)
            .setName('Reload Obsidian after plugin changes')
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.reloadAfterPluginChanges)
                    .onChange(async (value) => {
                        this.plugin.settings.reloadAfterPluginChanges = value;
                        await this.plugin.saveData(false);
                    })
            );
        containerEl.createEl('hr').createEl('br');


        containerEl.createEl('h3', { text: 'Changing any of the following settings will restore plugins to the original state.' });

        new Setting(containerEl)
            .setName('Use Filters on Plugin Display Names')
            .setDesc('If this is off, DAC will only match plugins by their ID')
            .addToggle((toggle) => {
                this.toggles.push(toggle);
                return toggle
                    .setValue(this.plugin.settings.filterUsingDisplayName)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingDisplayName = value;
                        await this.plugin.saveData();
                    });
            }
            );

        new Setting(containerEl)
            .setName('Use Filters on Plugin Authors')
            .addToggle((toggle) => {
                this.toggles.push(toggle);
                return toggle
                    .setValue(this.plugin.settings.filterUsingAuthor)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingAuthor = value;
                        await this.plugin.saveData();
                    });
            }
            );

        new Setting(containerEl)
            .setName('Use Filters on Plugin Descriptions')
            .addToggle((toggle) => {
                this.toggles.push(toggle);
                return toggle
                    .setValue(this.plugin.settings.filterUsingDescription)
                    .onChange(async (value) => {
                        this.plugin.settings.filterUsingDescription = value;
                        await this.plugin.saveData();
                    });
            }
            );

        let pluginExclusions = new Setting(containerEl)
            .setName('Plugin Exclusions')
            .setDesc('Exclude plugins using regex (case insensitive).\nEach new line is a new regex. Plugin ids are used for matching by default. Included plugins are on the left, excluded on the right. ');
        this.addTextArea({
            mode: 'plugins',
            container: pluginExclusions,
            placeholder: '^daily/\n\\.png$\netc...',
            value: this.plugin.settings.pluginFilterRegexes.join('\n'),
            disabledArea: this.addTextArea({ mode: 'plugins', container: pluginExclusions })
        });

        let snippetExclusions = new Setting(containerEl)
            .setName('Snippet Exclusions')
            .setDesc('Exclude snippets using regex (case insensitive).\nEach new line is a new regex. Snippet are only exclude by their name.');
        this.addTextArea({
            mode: 'snippets',
            container: snippetExclusions,
            placeholder: '^daily/\n\\.png$\netc...',
            value: this.plugin.settings.snippetFilterRegexes.join('\n'),
            disabledArea: this.addTextArea({ mode: 'snippets', container: snippetExclusions })
        });

        [pluginExclusions, snippetExclusions].forEach(s => {
            s.controlEl.style.width = '100%';
            s.infoEl.style.width = '45%';
        });
    }

    addTextArea({ mode, container, placeholder, value, disabledArea }: TextAreaArgs) {
        let ret: TextAreaComponent;
        let reset = (area: TextAreaComponent, mode: Mode) => {
            this.plugin.saveData();
            area.setPlaceholder(
                [...(this.plugin.getIncludedItems(mode))].map(p => p.name).join('\n')
            ).setDisabled(true);
        };

        container.addTextArea((textArea) => {
            ret = textArea;
            textArea.inputEl.setAttr('rows', 10);
            textArea.inputEl.style.width = '100%';
            if (value) textArea.setPlaceholder(placeholder).setValue(value);
            textArea.setPlaceholder(
                placeholder ?? [...(this.plugin.getIncludedItems(mode))].map(p => p.name).join('\n')
            ).setDisabled(!disabledArea);

            if (disabledArea) {
                this.toggles.forEach(t => t.toggleEl.onClickEvent(reset.bind(this, disabledArea, mode)));
                textArea.inputEl.onblur = (e: FocusEvent) => {
                    this.setFilters(mode, (e.target as HTMLInputElement).value);
                    reset(disabledArea, mode);
                };
            }
        });
        return ret;
    }
    
    setFilters(mode: Mode, input: string) {
        let f = input?.split('\n').filter(p => p.length);
        switch (mode) {
            case 'plugins': this.plugin.settings.pluginFilterRegexes = f; break;
            case 'snippets': this.plugin.settings.snippetFilterRegexes = f; break;
        }
        this.plugin.saveData();
    }



}