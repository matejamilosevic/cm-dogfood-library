import { describe, expect, it } from 'vitest';
import { findBookByIsbn, getBook, listBooks } from '../src/catalog.js';

describe('catalog', () => {
  it('lists seeded titles', () => {
    const titles = listBooks().map((book) => book.title);
    expect(titles).toContain('The Odyssey');
    expect(titles).toContain('Pride and Prejudice');
  });

  it('finds a book by dashed ISBN', () => {
    expect(findBookByIsbn('978-0-14-044913-6')?.id).toBe('b-1');
    expect(getBook('b-1')?.author).toBe('Homer');
  });
});
