import process from 'process';
import path from 'path';
import glob from 'glob';
import fs from 'fs-extra-promise';
import MarkdownIt from 'markdown-it';
import Handlebars from 'handlebars';
import colors from 'colors';
import {addTask, runTasks, setWatchMode} from './task';
import {logWarn} from './task';
import koa from 'koa';
import koaStatic from 'koa-static';
import mount from 'koa-mount';
import gracefulShutdown from 'http-graceful-shutdown';
import { renderPDF } from './render-pdf';


const THEME_DIR = path.join(__dirname, '../theme');

class Content {
	children: Record<string, Content> = {};
	childrenList: Content[] = [];
	next?: Content;
	prev?: Content;

	static currentContent?: Content;
	static pathToMap: Record<string, Content> = {};

	isLeaf = false;

    figureIndex = 1;

	get indexPath(): number[] {
		if (!this.parent) {
			return [];
		}

		return this.parent.indexPath.concat(this.parent.childrenList.indexOf(this));
	}

	get isChapterFirstChild() {
		const thisChildIndex = this.parent?.childrenList.indexOf(this);
		return thisChildIndex === 0 && this.parent?.isChapter;
	}

	get index(): string {
		if (this.isChapterFirstChild) {
			return this.parent?.index!;
		}
		if (this.isChapter) {
			// logic for chapter
			// chapter 1 start from first directory
			const fisrtChapterIndex = this.book.fisrtChapterIndex;
			const index = this.parent!.childrenList.indexOf(this);
			if (index < fisrtChapterIndex) {
				return '';
			}
			return this.book.getRenderer('chapter.hbs')({ index: index - fisrtChapterIndex + 1 });
		}
		const indexPath = this.indexPath.slice(0);
		if (indexPath[indexPath.length - 1] === 0) {
			indexPath.pop();
		}
		return indexPath.length > 0 ? indexPath.join('.') : '';
	}

	get title(): string {
		if (this.isLeaf) {
			const content = this.getContent();
			const REGEX_TITLE = /#+ (.+)/;
			const result = REGEX_TITLE.exec(content);
			if (result && result.length > 0 && !/##/.test(result[0])) {
				return result[1];
			}
			logWarn(`Markdown should start with a # Title: ${this.filePath}`);
			return this.name;
		}

		return this.childrenList[0].title;
	}

    get isChapter() {
        return this.parent && !this.parent.parent;
    }

	get indexTitle() {
		return `${this.index} ${this.title}`;
	}

    generateFigureIndex(): string {
        // index order by chapter
        if (this.isChapter) {
            return `${this.indexPath}-${this.figureIndex ++}`;
        }

        return this.parent?.generateFigureIndex()!;
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

		Content.pathToMap[filePath] = this;
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

	generateTocHTML(options: {
		print?: boolean,
	} = {}): string {
		const {
			print = false,
		} = options;
        const excludeChapterFisrtChildList = (content: Content) => {
            if (!content.parent) {
                return content.childrenList;
            }
            return content.childrenList.slice(1);
        }
		const vars = {
			title: this.title,
			href: (print ? '#': '') + this.relativePath,
			index: this.index,
			// Skip first intro section
			children: this.isLeaf
				? null
				: excludeChapterFisrtChildList(this)
						.map((item) => item.generateTocHTML(options))
						.join(''),
			beforeFirstChapter: this.indexPath[0] < this.book.fisrtChapterIndex,
			root: this.parent === null,
		};
		if (this.isLeaf) {
			return this.book.getRenderer('sidebar-section.hbs')(vars);
		}

		return this.book.getRenderer('sidebar-chapter.hbs')(vars);
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
        Content.currentContent = this;
		const content = this.getContent();
        return this.book.renderMarkdown(this);
	}
}

class Book {
	cwd: string = process.cwd();
	entryDir = 'book';
	outputDir = 'dist';
	publicDir = 'public';
    md: MarkdownIt | null = null;

	serverUrl: string = '';
	koaApp?: koa;

    referenceMap: Record<string, string> = {};

	template?: HandlebarsTemplateDelegate;

	entries: string[] = [];
	content: Content = new Content('root', this.entryDirPath, null, this);

	templateCache: Record<string, HandlebarsTemplateDelegate> = {};

	getRenderer(name: string) {
		if (this.templateCache[name]) {
			return this.templateCache[name];
		}
		const userTplPath = path.join(this.entryDirPath, name);
		const tplPath = path.join(THEME_DIR, name);
		const userTplExisted = fs.existsSync(userTplPath);
		if (userTplExisted) {
			logWarn(`User template detected: ${userTplPath}`);
		}
		const content = fs.readFileSync(userTplExisted ? userTplPath : tplPath, 'utf-8');
		const result = Handlebars.compile(content);
		this.templateCache[name] = result;
		return result;
	}

    options = {
        defaultTheme: 'light',
        base: '/',
		buildPDF: false,
    };

    constructor(options: Record<string, any>) {
        Object.assign(this.options, options);
    }

	get firstChapterContent() {
		return this.content.childrenList.find(item => !item.isLeaf);
	}

	get fisrtChapterIndex() {
		return this.content.childrenList.findIndex(item => !item.isLeaf);
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
        this.md.renderer.rules.image = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const srcIndex = token.attrIndex('src');
            const titleIndex = token.attrIndex('title');

            let url = token.attrs![srcIndex][1];

            if (!/^http(s)?/.test(url)) {
                url = this.getConfig().base + url.replace(/^(\.\.\/)+/, '');
            }

            const fullCaption = (titleIndex !== -1) ? token.attrs![titleIndex][1] : null;

			const [caption, id] = fullCaption?.split('|').map(item => item.trim()) || [];

            const alt = this.md!.utils.escapeHtml(token.content);

            let index = this.referenceMap[id];
            index = index || (caption ? Content.currentContent?.generateFigureIndex() : null) as string;

			const indexString = index ? this.getRenderer('image-index.hbs')({ index }) : '';

            if (id && index) {
                this.referenceMap[id] = index;
            }

            return this.getRenderer('image.hbs')({
                alt,
                caption,
                url,
                id,
                index: indexString,
            });
		};
    }

    renderMarkdown(content: Content) {
		const str = content.getContent();
        let html = this.md?.render(str)!;

		html = html.replace(new RegExp(`<h1>${content.title}</h1>`), (match, g1) => {
			const isFirstChapter = content.isChapterFirstChild && (content.parent === this.firstChapterContent);
			const classes = [
				(content.isChapterFirstChild || content.isChapter) && 'chapter-title',
				isFirstChapter && 'chapter-first-chapter',
			].filter(item => item).join(' ')
			return `<h1 id="${content.relativePath}" class="${classes}">${content.indexTitle}</h1>`;
		});
		
        html = html.replace(/<a href=\"#(.*?)\">.*?<\/a>/g, (match, g1) => {
            const index = this.referenceMap[g1];
            if (!index) {
				logWarn(`Can not found refernce with id: ${g1}`);
                return match;
            }
			const indexString = this.getRenderer('image-index.hbs')({ index });
            return `<a href="#${g1}">${indexString}</a>`;
        })!;
	
		html = html.replace(/<a href=\"(.*?)\">.*?<\/a>/g, (match, g1) => {
			if (/^#/.test(g1) || /^http(s)?/.test(g1)) {
				return match;
			}
            const fullPath = path.join(path.dirname(content.filePath), g1);
			const targetContent = Content.pathToMap[fullPath];
			if (!targetContent) {
				return match;
			}
            return `<a href="${targetContent.relativePath}">${targetContent.indexTitle}</a>`;
        });

		return html;
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

					const dir = path.dirname(outputFile);
					addTask(
						`Rendering ${outputFile}`,
						() => {
                            const content = child.renderMarkdown();
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
								title: this.content.title,
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

	async start() {
        setWatchMode();
		this.scanFiles();
		this.initTheme();
		this.render();
		this.initPublic();
		await this.initServer();
	}

	async build() {
		this.scanFiles();
		this.initTheme();
		this.render();
		this.initPublic();

		const buildPDF = this.getConfig().buildPDF;
		if (buildPDF) {
			this.renderPDF();
		}
        await runTasks();
        console.log(colors.green('🚀 Build DONE!'));
		if (buildPDF) {
			process.exit(0);
		}
	}

	renderPDF() {

		// toc
		const tocHTMLs: string[] = [];
		this.content.childrenList.forEach(child => {
			tocHTMLs.push(child.generateTocHTML({ print: true }));
		});
		const toc = tocHTMLs.join('\n');

		let cur: undefined | Content = this.content.childrenList[0];
		if (!cur.isLeaf) {
			cur = cur.childrenList[0];
		}

		const htmls: string[] = [];
		while (cur) {
			const target = cur;
			if (cur.isLeaf) {
				addTask(`Rendering PDF from file ${target.filePath}`, () => {
					htmls.push(target.renderMarkdown());
				});
			}
			cur = cur.next;
		}
		const PDF_HTML_NAME = 'bookone_output_pdf.html';
		const pdfTargetPath = path.join(this.outputDirPath, 'book.pdf');

		addTask(`Building PDF: ${colors.green(pdfTargetPath)}, this step maybe slow, please waiting`, async () => {
			const htmlContent = htmls.join('\n');
			const htmlTargetPath = path.join(this.outputDirPath, PDF_HTML_NAME);

			const fullHTML = this.getRenderer('print.hbs')({
					content: htmlContent,
					toc,
			});
			fs.writeFileSync(htmlTargetPath, fullHTML, 'utf-8');
			await this.startServer();
			await renderPDF(this.serverUrl + PDF_HTML_NAME, pdfTargetPath);
			await this.stopServer();
		});

	addTask(`Build PDF DONE`, () => {
		// do nothing
	});
}

	private stopServer() {
		gracefulShutdown(this.koaApp);
	}

	private startServer() {
		this.koaApp = new koa();

		const app = this.koaApp;
		const baseApp = new koa();
		baseApp.use(koaStatic(this.outputDirPath));

		const baseUrl = this.getConfig().base;
		if (baseUrl === '/') {
			app.use(koaStatic(this.outputDirPath));
		}
		app.use(mount(baseUrl, baseApp));

		const PORT = 8337;
		app.listen(PORT);
		const url = `http://127.0.0.1:${PORT}${baseUrl}`;
		this.serverUrl = url;
		
		return url;
	}

	async initServer() {
        await runTasks();
        this.startServer();
		console.log(`🚀 Open in browser: ${this.serverUrl}`);
	}
}

export default Book;
