## book

The `book` is core directory for bookone, bookone organize chapter & section automatic by file structure, and get **title** from first markdown file.

We recommend use number prefix(for example `01-`) to keep order.

```js
├── book
│   ├── 00-index.md // landing page of this book
│   ├── 01-file-structure // chapter 1                        <-----------------|
│   │   ├── 00-intro.md // Title & content in this markdown will be used here --|
│   │   ├── 01-book.md  // first section in chapter
│   │   └── 02-public.md
│   └── 02-cli.md // chapter 2, get title from markdown
```
