import { SettingsTab } from "obsidian";

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

export function queryText(el:HTMLElement, selector:string, text:string) {
	return Array.from<HTMLElement>(el.querySelectorAll(selector)).find((heading) => heading.innerText.includes(text));
}

// compose takes any number of functions, binds them to "_this", and returns a function that calls them in order
export const compose = (_this:any,...funcs: Function[]) => (...args: any[]) =>
	funcs.reduce((promise, func) => promise.then(func.bind(_this)), Promise.resolve());


export function makeArray(collection: HTMLCollection) {
	const array = [];
	for (let i = 0; i < collection.length; i++) {
		array.push(collection[i]);
	}
	return array;
}

// unlike plugins, snippets are not in a container, they are after the last .setting-item-heading in tab.containerEl
export function getSnippetItems(tab: SettingsTab) {
	const headings = tab.containerEl.querySelectorAll(".setting-item-heading");
	const lastHeading = headings[headings.length - 1];
	return Array.from(tab.containerEl.children).filter(
		(child) => child.compareDocumentPosition(lastHeading) & Node.DOCUMENT_POSITION_FOLLOWING
	);
}

export const Modes = [
	'plugins',
	'snippets'
] as const;

export type TFromArray<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer TFromArray> ? TFromArray : never;
export type Composed = (func: Func) => Func;
export type Func = () => any;
export type Mode = TFromArray<typeof Modes>;
export type JSONSetArrayMap = [Mode, string[][]][];