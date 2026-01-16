# Advanced Usage

Use frontmatter to set a category:

---
category: reference
---

Search will include this category label in results.

## Search Exclusions

You can skip a page by adding search: false in frontmatter.

---
search: false
---

## Long Form Content

Docfind works best with real paragraphs. Here is a longer section with repeated terms to test relevance:

The index builder extracts keywords from titles and bodies. A component that highlights a query in the title and category is useful for fast scanning. A query like "component" should match multiple documents, while "highlight" should show the styling behavior in the results.

## Sectioned Content

### Notes

Keep headings concise. Short headings help the index produce accurate results and clean titles.

### Reference

Add a category to group pages, such as reference, guide, or demo. The category is displayed under the title in search results.
