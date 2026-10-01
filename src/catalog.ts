import type { Book, BookId } from './types.js';

const books = new Map<BookId, Book>([
  [
    'b-1',
    {
      id: 'b-1',
      isbn: '9780140449136',
      title: 'The Odyssey',
      author: 'Homer',
      copies: 2,
    },
  ],
  [
    'b-2',
    {
      id: 'b-2',
      isbn: '9780141439518',
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      copies: 1,
    },
  ],
  [
    'b-3',
    {
      id: 'b-3',
      isbn: '9780553382563',
      title: 'A Short History of Nearly Everything',
      author: 'Bill Bryson',
      copies: 3,
    },
  ],
  [
    'b-4',
    {
      id: 'b-4',
      isbn: '9780141439471',
      title: 'Frankenstein',
      author: 'Mary Shelley',
      copies: 1,
    },
  ],
]);

export function listBooks(): Book[] {
  return [...books.values()];
}

export function getBook(bookId: BookId): Book | undefined {
  return books.get(bookId);
}

export function findBookByIsbn(isbn: string): Book | undefined {
  const needle = isbn.replace(/[-\s]/g, '');
  return [...books.values()].find((book) => book.isbn.replace(/[-\s]/g, '') === needle);
}
