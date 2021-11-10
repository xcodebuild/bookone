export function readTitleFromMarkdown(content: string) {
	const REGEX_TITLE = /# (.+)/;
	return REGEX_TITLE.exec(content)![1];
}
