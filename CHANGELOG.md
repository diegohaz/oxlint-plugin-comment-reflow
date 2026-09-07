# oxlint-plugin-comment-reflow

## 0.1.2

- Preserve comment lines that contain only an HTTP or HTTPS URL when reflowing surrounding prose.
- Fix paragraph wrapping when a prose line ends with a semicolon or starts with an HTML element name such as `<input>`.

## 0.1.1

- Preserve the space between a JSDoc tag header and a description from the next line. This prevents standalone tags such as `@deprecated` from becoming unrecognized tags such as `@deprecatedUse`.

## 0.1.0

- Add syntax-aware comment reflow and safe trailing-comment placement for Oxlint.
