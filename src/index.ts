import Book from "./book";

export function start(options: Object) {
    new Book(options).start();
}

export function build(options: Object) {
    new Book(options).build();
}
