import process from 'process';
import path from 'path';
import glob from 'glob';
import fs from 'fs-extra-promise';
import MarkdownIt from 'markdown-it';
import Handlebars from 'handlebars';
import colors from 'colors';
import {addTask} from './task';
import {readTitleFromMarkdown} from './utils';
import koa from 'koa';
import koaStatic from 'koa-static';
import mount from 'koa-mount';

const THEME_DIR = path.join(__dirname, '../theme');

const templateCache: Record<string, HandlebarsTemplateDelegate> = {};

function getRenderer(name: string) {
	if (templateCache[name]) {
		return templateCache[name];
	}

	const tplPath = path.join(THEME_DIR, name);
	const content = fs.readFileSync(tplPath, 'utf-8');
	const result = Handlebars.compile(content);
	templateCache[name] = result;
	return result;
}

class Content {
	children: Record<string, Content> = {};
	childrenList: Content[] = [];
	next?: Content;
	prev?: Content;

	static currentContent?: Content;

	isLeaf = false;

	get indexPath(): number[] {
		if (!this.parent) {
			return [];
		}

		return this.parent.indexPath.concat(this.parent.childrenList.indexOf(this));
	}

	get index() {
		return this.indexPath.join('.');
	}

	get title(): string {
		if (this.isLeaf) {
			return readTitleFromMarkdown(this.getContent());
		}

		return this.childrenList[0].title;
	}

	constructor(
		public name: string,
		public filePath: string,
		public parent: Content | null,
		public book: Book,
	) {
		if (!Content.currentContent) {
			Content.currentContent = this;
		} else {
			this.prev = Content.currentContent;
			Content.currentContent.next = this;
			Content.currentContent = this;
		}

		if (!fs.isDirectorySync(filePath)) {
			this.isLeaf = true;
		}
	}

	getContent() {
		return fs.readFileSync(this.filePath, 'utf-8');
	}

	get relativePath(): string {
		if (this.isLeaf) {
			return path.join(this.book.options.base, this.outputPath.replace(this.book.outputDirPath, ''));
		}

		return this.childrenList[0].relativePath;
	}

	generateTocHTML(): string {
        const excludeChapterFisrtChildList = (content: Content) => {
            if (!content.parent) {
                return content.childrenList;
            }
            return content.childrenList.slice(1);
        }
		const vars = {
			title: this.title,
			href: this.relativePath,
			index: this.index,
			// Skip first intro section
			children: this.isLeaf
				? null
				: excludeChapterFisrtChildList(this)
						.map((item) => item.generateTocHTML())
						.join(''),
			root: this.parent === null,
		};
		if (this.isLeaf) {
			return getRenderer('section.hbs')(vars);
		}

		return getRenderer('chapter.hbs')(vars);
	}

	get outputPath() {
		const outputFileRelative = this.filePath
			.replace(this.book.entryDirPath, '')
			.replace(/\.md$/, '.html');
		const removeIndexFromPath = (filePath: string) => {
			return filePath
				.split('/')
				.map((item) => item.replace(/^\d+-/, ''))
				.join('/');
		};

		const outputFile = path.join(
			this.book.outputDirPath,
			removeIndexFromPath(outputFileRelative),
		);
		return outputFile;
	}

	hasChild(name: string) {
		return Boolean(this.children[name]);
	}

	addChild(child: Content) {
		this.children[child.name] = child;
		this.childrenList.push(child);
	}

	getChild(name: string) {
		return this.children[name];
	}

	renderMarkdown() {
		return this.book.md!.render(this.getContent(), {});
	}
}

class Book {
	cwd: string = process.cwd();
	entryDir = 'book';
	outputDir = 'dist';
	publicDir = 'public';
    md: MarkdownIt | null = null;

	template?: HandlebarsTemplateDelegate;

	entries: string[] = [];
	content: Content = new Content('root', this.entryDirPath, null, this);

    options = {
        defaultTheme: 'light',
        base: '/',
    };

    constructor(options: Record<string, any>) {
        Object.assign(this.options, options);
    }

	get entryDirPath() {
		return path.join(this.cwd, this.entryDir);
	}

	get publicDirPath() {
		return path.join(this.cwd, this.publicDir);
	}

	get outputDirPath() {
		return path.join(this.cwd, this.outputDir);
	}

	private scanFiles() {
		const entries = glob
			.sync(`${this.entryDirPath}/**/*.md`)
			.map((item) => path.relative(this.entryDirPath, item));
		for (const item of entries) {
			const splitList = item.split('/');
			let cur = this.content;
			let pathBase = this.entryDirPath;
			for (const name of splitList) {
				if (!cur.hasChild(name)) {
					const child = new Content(name, path.join(pathBase, name), cur, this);
					cur.addChild(child);
				}

				cur = cur.getChild(name);
				pathBase = path.join(pathBase, name);
			}
		}
	}

	getConfig() {
		return this.options;
	}

	initPublic() {
		const files = glob.sync(`${this.publicDirPath}/**/*`);
		for (const file of files) {
			const target = file.replace(
				this.publicDirPath,
				path.join(this.outputDirPath, this.publicDir),
			);
			addTask(
				`Copy public file ${file}`,
				() => {
					fs.copySync(file, target);
				},
				[this.publicDirPath],
			);
		}
	}

	initTheme() {
		// Render theme
		const files = glob
			.sync(`${THEME_DIR}/**/*`)
			.filter((item) => !item.endsWith('.hbs'));
		files.map((file) => {
			const target = file.replace(THEME_DIR, this.outputDirPath);
			addTask(`Copy theme file ${target}`, () => {
				fs.copySync(file, target);
			});
		});
		this.initTemplateEngine();
        this.initMarkdown();
	}

	initTemplateEngine() {
		this.template = Handlebars.compile(
			fs.readFileSync(path.join(THEME_DIR, 'index.hbs'), 'utf-8'),
		);
	}

    initMarkdown() {
        this.md = new MarkdownIt();
        this.md.core.ruler.push('baseurl', (state: any): any => {
            const baseUrl = this.getConfig().base;
            function rewrite(tokens: any[]) {
              for (const token of tokens) {
                if (token.type === 'image') {
                  for (const attr of token.attrs) {
                    if (attr[0] === 'src') {
                      attr[1] = baseUrl + attr[1].replace(/^..\//, '');
                    }
                  }
                }
                // Process recursively
                if (token.children !== null) {
                  rewrite(token.children);
                }
              }
            }
            rewrite(state.tokens);
        });
    }

	render() {
		const renderContent = (content: Content) => {
			for (const child of content.childrenList) {
				if (child.isLeaf) {
					const outputFileRelative = child.filePath
						.replace(this.entryDirPath, '')
						.replace(/\.md$/, '.html');
					const removeIndexFromPath = (filePath: string) => {
						return filePath
							.split('/')
							.map((item) => item.replace(/^\d+-/, ''))
							.join('/');
					};

					const outputFile = path.join(
						this.outputDirPath,
						removeIndexFromPath(outputFileRelative),
					);

					const content = child.renderMarkdown();
					const dir = path.dirname(outputFile);
					addTask(
						`Rendering ${outputFile}`,
						() => {
							const html = this.template!({
								...this.getConfig(),
								content,
								pathToRoot: this.getConfig().base,
								next: {
									link: child.next?.relativePath,
								},
								previous: {
									link: child.prev?.relativePath,
								},
								toc: this.content.generateTocHTML(),
							});
							fs.mkdirpSync(dir);
							fs.writeFileSync(outputFile, html, 'utf-8');
						},
						[child.filePath],
					);
				} else {
					renderContent(child);
				}
			}
		};

		renderContent(this.content);
	}

	start() {
		this.scanFiles();
		this.initTheme();
		this.render();
		this.initPublic();
		this.initServer();
	}

	build() {
		this.scanFiles();
		this.initTheme();
		this.render();
		this.initPublic();
		addTask('Exit', () => {
			console.log(colors.green('🚀 Build DONE!'));
			process.exit(0);
		});
	}

	initServer() {
        const startServer = () => {
            const app = new koa();

            const baseApp = new koa();
            baseApp.use(koaStatic(this.outputDirPath));

            const baseUrl = this.getConfig().base;
            if (baseUrl === '/') {
                app.use(koaStatic(this.outputDirPath));
            }
            app.use(mount(baseUrl, baseApp));

            const PORT = 8337;
            app.listen(PORT);
            console.log('Server listening to', PORT);
            console.log(`🚀 Open in browser: http://127.0.0.1:${PORT}${baseUrl}`);
        };

		addTask('Start server', startServer);
	}
}

export default Book;
