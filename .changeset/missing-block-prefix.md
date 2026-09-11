---
"oxlint-plugin-comment-reflow": patch
---

Report missing `*` prefixes in blocks that start with a conventional aligned star. Keep the malformed block unchanged so the missing prefixes can be restored before reflow. Preserve plain blocks with Markdown bullets and unstarred JSDoc blocks.
