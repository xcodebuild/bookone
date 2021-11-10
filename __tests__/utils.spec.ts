import { readTitleFromMarkdown } from "../src/utils";

describe('Utils methods', () => {
    it('readTitleFromMarkdown', () => {
        expect(readTitleFromMarkdown(`# Test`)).toEqual('Test');
    });
});