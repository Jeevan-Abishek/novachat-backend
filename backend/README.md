# NovaChat Backend

Enterprise-grade realtime chat API: Node.js + Express + Socket.IO, horizontally
scaled behind Nginx with a Redis pub/sub adapter and a MongoDB replica set.

## Architecture

```
Client
  ↓
Nginx (load balancer, sticky sessions, rate limiting, TLS termination)
  ↓
Node.js + Socket.IO  (api1 / api2 / api3 — stateless, horizontally scaled)
  ↓
Redis Pub/Sub  (Socket.IO adapter — synchronizes events across all instances)
  ↓
MongoDB Replica Set  (primary + 2 secondaries, secondaryPreferred reads)
  ↓
Cloudinary  (media storage/CDN)  +  Background workers
```

## Quick start (Docker)

```bash
cp .env.example .env       # fill in real secrets
docker compose up --build
```

This brings up 3 API instances, Nginx, Redis, and a 3-node Mongo replica set.
On first run, initialize the replica set:

```bash
docker exec -it novachat-backend-mongo1-1 mongosh --eval \
  'rs.initiate({_id:"rs0", members:[{_id:0,host:"mongo1"},{_id:1,host:"mongo2"},{_id:2,host:"mongo3"}]})'
```

## Local development (single instance)

```bash
npm install
cp .env.example .env
npm run dev
```

## Folder structure

```
src/
  config/     env, db, redis, cloudinary connections
  models/     Mongoose schemas (User, Chat, Message, Poll, CallLog)
  middleware/ auth, rate limiting, validation, error handling
  controllers/ business logic per resource
  routes/     Express routers
  sockets/    Socket.IO bootstrap + realtime event handlers
  utils/      JWT helpers, logger
  app.js      Express app (security middleware + routes)
  server.js   HTTP server, DB connect, graceful shutdown
```

## Security

Helmet, strict CORS, JWT access + rotating refresh tokens, bcrypt password
hashing, XSS sanitization, HPP protection, and endpoint-specific rate limits
are all wired in by default — see `src/app.js` and `src/middleware/`.

## Scaling notes

- All API instances are stateless; session state lives in MongoDB + Redis so
  any instance can serve any request.
- Socket.IO's Redis adapter means a message emitted by api1 reaches a client
  connected to api3 without any direct connection between instances.
- Nginx `ip_hash` provides sticky sessions for the WebSocket handshake; swap
  for a cookie-based method behind a shared-IP CDN.
