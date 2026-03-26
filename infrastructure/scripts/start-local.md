# Local Infra

Start local MongoDB, Redis, and Mailpit:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Mailpit UI is available at `http://localhost:8025`.
