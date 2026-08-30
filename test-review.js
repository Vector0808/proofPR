const http = require('http');

const data = JSON.stringify({
  repo: 'G:\\proofpr-smoke',
  base: '0d6b62b',
  head: '2361457'
});

const req = http.request('http://localhost:3000/api/review', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const { runId, status } = JSON.parse(body);
    console.log(`Started run: ${runId}, status: ${status}`);

    const poll = setInterval(() => {
      http.get(`http://localhost:3000/api/runs/${runId}`, (pollRes) => {
        let pBody = '';
        pollRes.on('data', chunk => pBody += chunk);
        pollRes.on('end', () => {
          const runData = JSON.parse(pBody);
          console.log(`Job Status: ${runData.jobStatus}`);
          if (runData.jobStatus === 'completed' || runData.jobStatus === 'failed') {
            clearInterval(poll);
            console.log(JSON.stringify(runData.report.findings, null, 2));
          }
        });
      });
    }, 5000);
  });
});

req.on('error', console.error);
req.write(data);
req.end();
