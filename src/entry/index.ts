import process from 'process';
import minimist from 'minimist';
import Book from '../book';

const argv = minimist(process.argv.slice(2));
const [action] = argv._;

const normalizeArray = (target: string | Array<string>) => Array.isArray(target) ? target : [target || '']

const options = {
    title: argv.t || '',
    author: argv.author || '',
    additionalJs: normalizeArray(argv.j),
    additionalCss: normalizeArray(argv.c),
    base: argv.b || '/',
    buildPDF: argv.p || false,
};

export function run() {
    if (action === 'start') {
        return new Book(options).start();
    } else if (action === 'build') {
        return new Book(options).build();
    } else {
        console.log(`bookone - Zero configuration book genereator with Markdown.
    https://xcodebuild.github.io/bookone/
    
    bookone start - Start a dev server
    bookone build - Build book
    [arguments]
        -t Title
        -a Author
        -b Base url
        -j Additional JavaScript in webpage
        -c Additional CSS in webpage
        -p Build PDF book, only works in build 
    `);
    }
}

run();
