import shell from 'shelljs';
import path from 'path';
import fs from 'fs-extra-promise';

const EXAMPLE_DIR = path.join(__dirname, 'fixture/example');
const EXAMPLE_DIST_DIR = path.join(EXAMPLE_DIR, 'dist');
const BOOKONE_BIN = path.join(__dirname, '../bin/bookone');

const cleanup = () => {
    if (fs.existsSync(EXAMPLE_DIST_DIR)) {
        shell.rm(EXAMPLE_DIST_DIR);
    }
}

function readFileContent(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8');
}

describe('CLI', () => {
    beforeEach(cleanup);
    
    it('build works', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build`;
        shell.exec(command);
        const lsResult = shell.ls(EXAMPLE_DIST_DIR);
        expect(lsResult).toContain('chapter-one');
        expect(lsResult).toContain('chapter-two');
    });

    it('get title from markdown', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build`;
        shell.exec(command);
        // get Title
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-one/intro.html'))).toContain('Before Title');
    });

    it('build with -t', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build -t BookTitle`;
        shell.exec(command);
        // get Title
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-one/intro.html'))).toContain('<title>BookTitle</title>');
    });
});