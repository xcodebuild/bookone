export function sortByIndex(list: string[]) {
	return list
		.map((item) => {
			const [index, name] = item.split('-');
			return {
				index: Number.parseInt(index, 10),
				name,
				origin: item,
			};
		})
		.sort((a, b) => {
			return a.index - b.index;
		})
		.map((item) => {
			return item.origin;
		});
}

export function readTitleFromMarkdown(content: string) {
	const REGEX_TITLE = /# (.+)/;
	return REGEX_TITLE.exec(content)![1];
}
