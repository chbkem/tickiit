const fs = require('fs');
const path = require('path');

/**
 * CRA cannot bundle the Altcha widget directly: its webpack config treats `.cjs`
 * files as static assets (so `require('altcha')` only returns a URL), and its
 * Babel pass cannot parse the bundle's modern syntax (private class fields).
 *
 * So we copy the package's prebuilt UMD bundle into `public/` where it is served
 * as a plain `<script>` (see public/index.html). The browser then registers the
 * `<altcha-widget>` custom element.
 */
const source = require.resolve('altcha');
const destination = path.join(__dirname, '..', 'public', 'altcha.umd.js');

fs.copyFileSync(source, destination);
console.log(`[altcha] copied widget bundle to ${path.relative(process.cwd(), destination)}`);
