import process from 'process';
import minimist from 'minimist';
import Book from '../book';

const argv = minimist(process.argv.slice(2));
const [action] = argv._;

const normalizeArray = (target: string | Array<string>) => Array.isArray(target) ? target : [target || '']

const options = {
    title: argv.t || '',
    author: argv.author || '',
    additionalJs: normalizeArray(argv.js),
    additionalCss: normalizeArray(argv.css),
    base: argv.b || '/',
};

if (action === 'start') {
	new Book(options).start();
} else if (action === 'build') {
	new Book(options).build();
} else {
	console.log(`bookone - Zero configuration book genereator with Markdown.
https://xcodebuild.github.io/bookone/

bookone start - Start a dev server
bookone build - Build book
[arguments]
    -t Title
    -a Author
    -b Base url
    -js Additional JavaScript in webpage
`);
}
