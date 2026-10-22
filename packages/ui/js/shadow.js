/* The overlay CSS for a shadow root: the tokens hang on the host element
 * instead of :root and body. Used by the web script and by host apps. */
export function shadowCss(css) {
  return ":host { all: initial; }\n" + css
    .replace(/:root\b/g, ":host")
    .replace(/body\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
    .replace(/body:not\(\[data-theme="light"\]\)/g, ':host(:not([data-theme="light"]))');
}
