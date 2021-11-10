import shell from 'shelljs';
import path from 'path';
import fs from 'fs-extra-promise';
import cheerio from 'cheerio';

const EXAMPLE_DIR = path.join(__dirname, 'fixture/example');
const EXAMPLE_DIST_DIR = path.join(EXAMPLE_DIR, 'dist');
const BOOKONE_BIN = path.join(__dirname, '../bin/bookone');

const cleanup = () => {
    if (fs.existsSync(EXAMPLE_DIST_DIR)) {
        shell.rm('-rf', EXAMPLE_DIST_DIR);
    }
}

function readFileContent(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8');
}

function runWithArg(cwd: string, argv: string[]) {
    jest.resetModules();
    process.cwd = () => cwd;
    process.argv = [process.argv[0], process.argv[1]].concat(argv);
    require('../src/entry/index');
}

describe('CLI', () => {
    beforeEach(cleanup);
    
    it('build works', () => {
        runWithArg(EXAMPLE_DIR, ['build']);

        const lsResult = shell.ls(EXAMPLE_DIST_DIR);
        expect(lsResult).toContain('chapter-one');
        expect(lsResult).toContain('chapter-two');
    });

    it('get title from markdown', () => {
        runWithArg(EXAMPLE_DIR, ['build']);
        // get Title
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-one/intro.html'))).toContain('Before Title');
    });

    it('build with -t', () => {
        runWithArg(EXAMPLE_DIR, ['build', '-t', 'BookTitle']);
        // get Title
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-one/intro.html'))).toContain('<title>BookTitle</title>');
    });

    it('public files copy to dist', () => {
        runWithArg(EXAMPLE_DIR, ['build']);
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'public/mock.js'))).toMatchSnapshot();
    });

    it('image title will be display', () => {
        runWithArg(EXAMPLE_DIR, ['build']);

        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('figure img').attr('src')).toMatchSnapshot();
        expect($('figure figcaption').text().trim()).toMatchSnapshot();
    });

    it('image url repect baseurl', () => {
        runWithArg(EXAMPLE_DIR, ['build', '-b', '/baseurl/']);
        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('#mock img').attr('src')).toMatchSnapshot();
        expect($('#mock figcaption').text().trim()).toMatchSnapshot();
    });

    it('image cite', () => {
        runWithArg(EXAMPLE_DIR, ['build', '-b', '/baseurl/']);

        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('#xcodebuild img').attr('src')).toMatchSnapshot();
        expect($('[href="#xcodebuild"]').text().trim()).toMatchSnapshot();
    });

});