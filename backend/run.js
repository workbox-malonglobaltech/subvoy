/**
 * Preview-tool launcher — plain node, no transpilation needed.
 * Loads .env from the project root before booting the compiled dist,
 * because the dist's own __dirname is too deeply nested to find it.
 */
const path = require('path');
// project root is one level above backend/
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./dist/subbplus/backend/src/index.js');
