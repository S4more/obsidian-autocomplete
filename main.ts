import { Plugin } from 'obsidian';
import SuggestionPopup from 'src/popup';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class AutoCompletePlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
    console.log("Hey!")
    const suggestionPopup = new SuggestionPopup(this.app);
    this.registerEditorSuggest(suggestionPopup);
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
