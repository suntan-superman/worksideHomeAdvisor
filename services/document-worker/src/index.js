import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 4101);
const service = 'document-worker';
const startedAt = Date.now();
const recentJobs = [];
const capabilities = ['flyer_export', 'report_render', 'disclaimer_injection'];

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

function createDocumentJob(payload) {
  const job = {
    id: randomUUID(),
    jobType: payload.jobType || 'flyer_export',
    propertyId: payload.propertyId || null,
    status: 'completed',
    createdAt: new Date().toISOString(),
    output: {
      artifactType: payload.jobType === 'report_render' ? 'report_pdf' : 'flyer_pdf',
      storagePath: `documents/${payload.propertyId || 'unknown'}/${Date.now()}.pdf`,
      pageCount: payload.jobType === 'report_render' ? 8 : 1,
      includedSections:
        payload.jobType === 'report_render'
          ? ['cover', 'pricing', 'comps', 'photos', 'checklist']
          : ['hero', 'highlights', 'cta'],
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

  if (request.method === 'GET' && request.url === '/capabilities') {
    sendJson(response, 200, { service, capabilities });
    return;
  }

  if (request.method === 'GET' && request.url === '/jobs') {
    sendJson(response, 200, { jobs: recentJobs });
    return;
  }

  if (request.method === 'POST' && request.url === '/jobs') {
    try {
      const payload = await readJson(request);
      const job = createDocumentJob(payload);
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
