import { readTitleFromMarkdown } from "../dist/utils";

describe('Utils methods', () => {
    it('readTitleFromMarkdown', () => {
        expect(readTitleFromMarkdown(`# Test`)).toEqual('Test');
    });
});