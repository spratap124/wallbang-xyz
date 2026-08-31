import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderSimpleMarkdown } from "./legal";

describe("renderSimpleMarkdown", () => {
  it("renders headings, paragraphs, and mailto links", () => {
    const html = renderSimpleMarkdown(`# Title

Hello [admin@wallbang.xyz](mailto:admin@wallbang.xyz).
`);

    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(
      html,
      /<a href="mailto:admin@wallbang.xyz" rel="noopener noreferrer">admin@wallbang.xyz<\/a>/,
    );
  });

  it("renders unordered lists and bold text", () => {
    const html = renderSimpleMarkdown(`## Details

- **Trade Name:** WallBang
- **Legal Name:** Shivani
`);

    assert.match(html, /<h2>Details<\/h2>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<li><strong>Trade Name:<\/strong> WallBang<\/li>/);
    assert.match(html, /<li><strong>Legal Name:<\/strong> Shivani<\/li>/);
  });

  it("renders ordered lists separately from headings", () => {
    const html = renderSimpleMarkdown(`## 1. Operator

Please include:

1. Steam ID
2. Order ID
`);

    assert.match(html, /<h2>1. Operator<\/h2>/);
    assert.match(html, /<ol><li>Steam ID<\/li><li>Order ID<\/li><\/ol>/);
  });
});
