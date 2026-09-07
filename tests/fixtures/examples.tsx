/**
 * Returns props to create a `Button` component. If the element is not a native
 * button, the hook will return additional props to make sure it's accessible.
 * @see https://ariakit.com/components/button
 * @example
 * ```jsx
 * const props = useButton({ render: <div /> });
 * <Role {...props}>Accessible button</Role>
 * ```
 */
export function ariakitExample0() {}

/**
 * Renders an accessible button element. If the underlying element is not a
 * native button, this component will pass additional attributes to make sure
 * it's accessible.
 * @see https://ariakit.com/components/button
 * @example
 * ```jsx
 * <Button>Button</Button>
 * ```
 */
export function ariakitExample1() {}

/**
 * A longer description of the HTML example that should wrap without changing the example itself.
 *
 * @example
 * ```html
 * <a title="a">text</a>
 * ```
 * @example <caption>Unfenced example</caption>
 * const link = document.createElement('a')
 *
 *   link.textContent = 'Hello'
 * @returns {HTMLAnchorElement} An anchor with a useful descriptive text value.
 */
export function example() {}

/**
 * A longer description for a fenced TSX example with metadata.
 * @example
 * ```tsx live title="Button example" {1,3}
 * <Button>
 *   Hello
 * </Button>
 * ```
 */
export function metadataExample() {}
