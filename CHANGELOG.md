# oxlint-plugin-comment-reflow

## 0.2.1

### Patch Changes

- 14361aa: Report missing `*` prefixes in blocks that start with a conventional aligned star. Keep the malformed block unchanged so the missing prefixes can be restored before reflow. Preserve plain blocks with Markdown bullets and unstarred JSDoc blocks.

## 0.2.0

### Minor Changes

- 1d9b268: Reflow comments inside empty JSX expressions and standalone line and block comments between JSX props. Keep JSX braces and adjacent text intact.

## 0.1.2

- Preserve comment lines that contain only an HTTP or HTTPS URL when reflowing surrounding prose.
- Fix paragraph wrapping when a prose line ends with a semicolon or starts with an HTML element name such as `<input>`.

## 0.1.1

- Preserve the space between a JSDoc tag header and a description from the next line. This prevents standalone tags such as `@deprecated` from becoming unrecognized tags such as `@deprecatedUse`.

## 0.1.0

- Add syntax-aware comment reflow and safe trailing-comment placement for Oxlint.
