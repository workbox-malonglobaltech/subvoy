// Launcher for the preview tool — changes cwd to backend/ then boots ts-node.
// This is needed because the preview runner starts from the monorepo root and
// ts-node needs to find backend/tsconfig.json via the CWD.
const path = require('path');
process.chdir(__dirname);
require('ts-node').register({ transpileOnly: true });
require('./src/index.ts');
