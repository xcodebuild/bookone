# bookone

Zero configuration book genereator with Markdown.

## Usage
```
# install bookone
npm install -g bookone

# init a book
mkdir -p newbook/book
cd newbook
echo '# Intro Title\n I am content' > book/00-index.md
echo '# Chapter 1\n I am content of chapter 1' > book/01-chapter-one.md

# start a server and watch change
bookone start -t bookone -a author

# build only
bookone build -t bookone -a author
```

# Screenshot
![](../public/images/safari.png)
![](../public/images/terminal.png)

# Related
- default theme from [mdBook](https://github.com/rust-lang/mdBook).