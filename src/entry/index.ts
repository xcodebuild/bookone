import process from 'process';
import minimist from 'minimist';
import Book from '../book';

const argv = minimist(process.argv.slice(2));
const [action] = argv._;

console.log(argv);

const options = {
    title: argv.t || '',
    author: argv.author || '',
    additionalJs: Array.isArray(argv.js) ? argv.js : [argv.js || ''],
};

if (action === 'start') {
	new Book(options).start();
} else if (action === 'build') {
	new Book(options).build();
} else {
	console.log(`bookone - Zero configuration book genereator with Markdown.
bookone start - Start a dev server
bookone build - Build book
[arguments]
    -t Title
    -a Author
    -js Additional JavaScript in webpage
`);
}
