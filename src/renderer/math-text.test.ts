import { describe, expect, it } from 'vitest';
import { mathText } from './math-text';

describe('mathText pass-through', () => {
  it('plain text without patterns is unchanged (after trivial escape)', () => {
    expect(mathText('What is the area of a circle?')).toBe(
      'What is the area of a circle?',
    );
  });

  it('Unicode math glyphs pass through unchanged', () => {
    expect(mathText('A = π · r²')).toBe('A = π · r²');
    expect(mathText('hypotenuse = √(a² + b²)')).toBe(
      'hypotenuse = √(a² + b²)',
    );
    expect(mathText('½ · b · h, ⅓ · A · h')).toBe('½ · b · h, ⅓ · A · h');
  });
});

describe('mathText superscript wrapping', () => {
  it('wraps a trailing ^{N} into <sup>N</sup>', () => {
    expect(mathText('x^{11}')).toBe('x<sup>11</sup>');
  });

  it('wraps an embedded ^{N} into <sup>N</sup>', () => {
    expect(mathText('a^{2} + b^{2} = c^{2}')).toBe(
      'a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup>',
    );
  });

  it('handles a negative exponent ^{-2}', () => {
    expect(mathText('e^{-x}')).toBe('e<sup>-x</sup>');
  });

  it('handles a mixed letter+digit exponent ^{n+1}', () => {
    expect(mathText('x^{n+1}')).toBe('x<sup>n+1</sup>');
  });
});

describe('mathText subscript wrapping', () => {
  it('wraps a trailing _{N} into <sub>N</sub>', () => {
    expect(mathText('x_{0}')).toBe('x<sub>0</sub>');
  });

  it('wraps multiple subscripts', () => {
    expect(mathText('a_{1} + a_{2} + a_{3}')).toBe(
      'a<sub>1</sub> + a<sub>2</sub> + a<sub>3</sub>',
    );
  });

  it('handles a letter subscript _{n}', () => {
    expect(mathText('x_{n}')).toBe('x<sub>n</sub>');
  });
});

describe('mathText mixed super + sub', () => {
  it('handles superscripts and subscripts together', () => {
    expect(mathText('a_{i}^{2}')).toBe('a<sub>i</sub><sup>2</sup>');
  });

  it('handles a sigma-style summation', () => {
    expect(mathText('Σ_{i=0}^{n} a_{i}')).toBe(
      'Σ<sub>i=0</sub><sup>n</sup> a<sub>i</sub>',
    );
  });
});

describe('mathText HTML escaping', () => {
  it('escapes < and > as literal text', () => {
    expect(mathText('a < b > c')).toBe('a &lt; b &gt; c');
  });

  it('escapes & as &amp;', () => {
    expect(mathText('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes a fake tag literally instead of letting it parse', () => {
    expect(mathText('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes quote characters', () => {
    expect(mathText(`"hi" 'there'`)).toBe('&quot;hi&quot; &#39;there&#39;');
  });

  it('escapes input first, so a ^{<script>} payload is neutralised', () => {
    // The escape pass runs first, so the angle brackets are already entities
    // by the time the ^{...} regex sees them. The wrapped content lands
    // verbatim inside <sup>, so no live script tag can form.
    expect(mathText('x^{<script>}')).toBe('x<sup>&lt;script&gt;</sup>');
  });
});

describe('mathText pattern boundary cases', () => {
  it('a standalone caret without braces is left alone', () => {
    expect(mathText('a ^ b')).toBe('a ^ b');
  });

  it('a standalone underscore without braces is left alone', () => {
    expect(mathText('snake_case')).toBe('snake_case');
  });

  it('an empty pattern ^{} does not wrap (no matching content)', () => {
    expect(mathText('x^{}')).toBe('x^{}');
  });
});
