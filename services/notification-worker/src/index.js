import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 4104);
const service = 'notification-worker';
const startedAt = Date.now();
const recentJobs = [];
const capabilities = ['otp_delivery', 'email_notifications', 'reminder_jobs'];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function createNotificationJob(payload) {
  const job = {
    id: randomUUID(),
    jobType: payload.jobType || 'email_notification',
    userId: payload.userId || null,
    status: 'completed',
    createdAt: new Date().toISOString(),
    output: {
      channel: payload.channel || 'email',
      recipient: payload.recipient || payload.email || null,
      queued: false,
      deliveredAt: new Date().toISOString(),
    },
  };

  recentJobs.unshift(job);
  recentJobs.splice(20);
  return job;
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      ok: true,
      service,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      recentJobCount: recentJobs.length,
      capabilities,
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/jobs') {
    sendJson(response, 200, { jobs: recentJobs });
    return;
  }

  if (request.method === 'GET' && request.url === '/capabilities') {
    sendJson(response, 200, { service, capabilities });
    return;
  }

  if (request.method === 'POST' && request.url === '/jobs') {
    try {
      const payload = await readJson(request);
      const job = createNotificationJob(payload);
      sendJson(response, 201, { job });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  sendJson(response, 404, { message: 'Not found.' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[${service}] listening on ${port}`);
});
