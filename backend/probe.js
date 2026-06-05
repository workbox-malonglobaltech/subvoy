console.log('node probe running, version:', process.version);
const http = require('http');
http.createServer((req, res) => res.end('probe ok')).listen(3001, () => {
  console.log('probe listening on 3001');
});
