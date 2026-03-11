const express = require('express');
const { Client } = require('pg');
const { createClient: createRedisClient } = require('redis');

const app = express();

app.use(express.json());

// OpenAPI 3.0 spec для Swagger UI (администрирование API)
const openApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Dev Env API', version: '1.0.0', description: 'API тестовой среды разработчика' },
  servers: [{ url: '/', description: 'Текущий хост (через proxy)' }],
  paths: {
    '/api/status': {
      get: {
        summary: 'Статус сервисов',
        description: 'Проверка backend, PostgreSQL и Redis',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } }
      }
    },
    '/api/hello': {
      get: {
        summary: 'Проверка связи с backend',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } }
      }
    },
    '/api/notes': {
      get: {
        summary: 'Список заметок',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'array' } } } } } } }
      },
      post: {
        summary: 'Создать заметку',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 200 } } } } } },
        responses: { 201: { description: 'Создано' }, 400: { description: 'Ошибка валидации' } }
      }
    }
  }
};

app.get('/api-docs.json', (req, res) => res.json(openApiSpec));
app.get('/api/api-docs', (req, res) => res.json(openApiSpec));

const pgConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'devuser',
  password: process.env.POSTGRES_PASSWORD || 'devpass',
  database: process.env.POSTGRES_DB || 'devdb'
};

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

// Небольшая фича для КР: заметки (in-memory, только для демонстрации)
const notes = [];

app.get('/api/status', async (req, res) => {
  const status = {
    backend: 'ok',
    time: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV || 'development',
      hostname: process.env.HOSTNAME || 'unknown'
    },
    services: {
      postgres: 'unknown',
      redis: 'unknown'
    }
  };

  // Check PostgreSQL
  try {
    const client = new Client(pgConfig);
    await client.connect();
    const result = await client.query('SELECT NOW() as now');
    status.services.postgres = `ok (${result.rows[0].now.toISOString()})`;
    await client.end();
  } catch (err) {
    status.services.postgres = `error (${err.message})`;
  }

  // Check Redis
  try {
    const redisClient = createRedisClient({ url: redisUrl });
    await redisClient.connect();
    const pong = await redisClient.ping();
    status.services.redis = `ok (PING=${pong})`;
    await redisClient.disconnect();
  } catch (err) {
    status.services.redis = `error (${err.message})`;
  }

  res.json(status);
});

app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Привет из backend-контейнера!',
    time: new Date().toISOString()
  });
});

// Заметки: простая фича для демонстрации и unit-тестов
app.get('/api/notes', (req, res) => {
  res.json({ notes });
});

app.post('/api/notes', (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Текст заметки обязателен.' });
  }
  if (text.length > 200) {
    return res.status(400).json({ error: 'Текст заметки не должен превышать 200 символов.' });
  }
  const note = {
    id: notes.length + 1,
    text,
    createdAt: new Date().toISOString()
  };
  notes.push(note);
  res.status(201).json({ note });
});

module.exports = app;

