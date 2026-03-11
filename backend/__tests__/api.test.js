const request = require('supertest');
const app = require('../app');

describe('Backend API', () => {
  it('GET /api/hello возвращает приветствие и время', async () => {
    const res = await request(app).get('/api/hello');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(res.body).toHaveProperty('time');
  });

  it('POST /api/notes c пустым текстом возвращает 400', async () => {
    const res = await request(app).post('/api/notes').send({ text: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/notes c валидным текстом создаёт заметку, а GET /api/notes её показывает', async () => {
    const text = 'Первая тестовая заметка';
    const createRes = await request(app).post('/api/notes').send({ text });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty('note');
    expect(createRes.body.note.text).toBe(text);

    const listRes = await request(app).get('/api/notes');
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body.notes)).toBe(true);
    const found = listRes.body.notes.find(n => n.text === text);
    expect(found).toBeDefined();
  });
});

