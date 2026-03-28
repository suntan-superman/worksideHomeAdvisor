import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 4103);
const service = 'market-data-worker';
const startedAt = Date.now();
const recentJobs = [];
const capabilities = ['comp_normalization', 'score_support', 'provider_caching'];

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

function normalizeComp(comp) {
  const distanceMiles = Number(comp.distanceMiles || comp.distance || 0);
  const price = Number(comp.price || 0);
  const sqft = Number(comp.sqft || 0);
  const pricePerSqft = sqft > 0 ? Math.round(price / sqft) : 0;
  const score = Math.max(0, Number((1 - Math.min(distanceMiles, 3) / 3).toFixed(2)));

  return {
    address: comp.address || 'Unknown address',
    distanceMiles,
    price,
    sqft,
    pricePerSqft,
    score,
  };
}

function createMarketDataJob(payload) {
  const normalized = (payload.comps || []).map((comp) => normalizeComp(comp));
  const job = {
    id: randomUUID(),
    jobType: payload.jobType || 'comp_normalization',
    propertyId: payload.propertyId || null,
    status: 'completed',
    createdAt: new Date().toISOString(),
    output: {
      normalizedCount: normalized.length,
      topComps: normalized.sort((left, right) => right.score - left.score).slice(0, 5),
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
      const job = createMarketDataJob(payload);
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
