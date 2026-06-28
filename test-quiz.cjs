const http = require('http');

const data = JSON.stringify({
  quiz: { title: "Test", questions: [] },
  accessToken: "fake",
  spreadsheetId: "fake"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/share-quiz',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', e => {
  console.error(e);
});

req.write(data);
req.end();
