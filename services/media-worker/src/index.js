import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 4102);
const service = 'media-worker';
const startedAt = Date.now();
const recentJobs = [];
const capabilities = ['thumbnail_generation', 'room_guess', 'quality_summary'];

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

function inferRoomLabel(roomLabel = '') {
  const normalized = String(roomLabel).toLowerCase();
  if (normalized.includes('kitchen')) return 'kitchen';
  if (normalized.includes('bath')) return 'bathroom';
  if (normalized.includes('bed')) return 'bedroom';
  if (normalized.includes('exterior')) return 'exterior';
  return 'living_room';
}

function createMediaJob(payload) {
  const jobId = randomUUID();
  const roomGuess = inferRoomLabel(payload.roomLabel);
  const qualityScore = payload.width && payload.width >= 1400 ? 82 : 68;
  const job = {
    id: jobId,
    jobType: payload.jobType || 'thumbnail_generation',
    propertyId: payload.propertyId || null,
    mediaId: payload.mediaId || null,
    status: 'completed',
    createdAt: new Date().toISOString(),
    output: {
      roomGuess,
      qualityScore,
      thumbnailPath: `media/${payload.propertyId || 'unknown'}/thumbs/${payload.mediaId || jobId}.jpg`,
      suggestions:
        qualityScore >= 80
          ? ['Strong candidate for listing materials.']
          : ['Retake in brighter light for stronger marketing use.'],
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
      const job = createMediaJob(payload);
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
