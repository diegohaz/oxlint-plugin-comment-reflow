const string = "// This long string is not a comment and must remain intact.";
const blockString = "/* Another long string that must remain intact. */";
const template = `// Not a comment.
/* Still not a comment. */`;
const regex = /https?:\/\/[^/]+\/\*stuff/;
const view = <div>// This JSX text is not a comment. /* Neither is this text. */</div>;
const expression = <div>{/* This comment beside an expression stays in place. */ value}</div>;
