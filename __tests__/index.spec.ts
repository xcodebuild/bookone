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

    it('public files copy to dist', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build`;
        shell.exec(command);
        expect(readFileContent(path.join(EXAMPLE_DIST_DIR, 'public/mock.js'))).toMatchSnapshot();
    });

    it('image title will be display', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build`;
        shell.exec(command);
        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('figure img').attr('src')).toMatchSnapshot();
        expect($('figure figcaption').text().trim()).toMatchSnapshot();
    });

    it('image url repect baseurl', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build -b /baseurl/`;
        shell.exec(command);
        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('#mock img').attr('src')).toMatchSnapshot();
        expect($('#mock figcaption').text().trim()).toMatchSnapshot();
    });

    it('image cite', () => {
        const command = `cd ${EXAMPLE_DIR} && ${BOOKONE_BIN} build -b /baseurl/`;
        shell.exec(command);
        const content = readFileContent(path.join(EXAMPLE_DIST_DIR, 'chapter-two/image/image-feature.html'));
        const $ = cheerio.load(content);
        expect($('#xcodebuild img').attr('src')).toMatchSnapshot();
        expect($('[href="#xcodebuild"]').text().trim()).toMatchSnapshot();
    });

});