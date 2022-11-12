// accepts a string and checks if it is a calc expression (limited to percentages and addition/subtraction) and returns the resulting string
export function simpleCalc(str: string) {
	const calcRegex = /calc\((\d+)%\s*([+-])\s*(\d+)%\)/;
	const match = str.match(calcRegex);
	if (!match) return str;
	const [_, a, op, b] = match;
	const result = op === "+" ? +a + +b : +a - +b;
	return str.replace(calcRegex, `${result}%`);
}

export function removeSetupDebugNotice() {
	let notices = document.querySelectorAll('.notice') as NodeListOf<HTMLElement>;
	for (let i = 0; i < notices.length; i++) {
		let notice = notices[i];
		if (notice?.innerText.includes('plugin setup')) notice.remove();
	}
}

// compose takes any number of functions, binds them to "_this", and returns a function that calls them in order
export const compose = (_this:any,...funcs: Function[]) => (...args: any[]) =>
	funcs.reduce((promise, func) => promise.then(func.bind(_this)), Promise.resolve());


// add type safety for the undocumented methods
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: string[];
			manifests: {[id:string]:PluginManifest};
			enabledPlugins: Set<string>;
			disablePluginAndSave: (id: string) => Promise<boolean>;
			enablePluginAndSave: (id: string) => Promise<boolean>;
			initialize: () => Promise<void>;
		};
		commands: {
			executeCommandById: (commandID: string) => void;

		};
		customCss: {
			enabledSnippets: Set<string>;
			snippets: string[];
			setCssEnabledStatus(snippet: string, enable: boolean): void;
		};

	}
}
