async function fetchJson(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}

function renderStatus(data) {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '';

  const backend = document.createElement('div');
  backend.textContent = `Backend: ${data.backend}, время: ${data.time}`;

  const env = document.createElement('div');
  env.textContent = `Контейнер: ${data.env.hostname}, NODE_ENV: ${data.env.node_env}`;

  const services = document.createElement('div');
  services.innerHTML = `
    <strong>PostgreSQL:</strong> ${data.services.postgres}<br/>
    <strong>Redis:</strong> ${data.services.redis}
  `;

  statusDiv.appendChild(backend);
  statusDiv.appendChild(env);
  statusDiv.appendChild(services);
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/status');
    renderStatus(data);
  } catch (err) {
    statusDiv.textContent = 'Ошибка: ' + err.message;
  }
});

document.getElementById('helloBtn').addEventListener('click', async () => {
  const out = document.getElementById('helloResult');
  out.textContent = 'Загрузка...';
  try {
    const data = await fetchJson('/api/hello');
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = 'Ошибка: ' + err.message;
  }
});

async function loadNotes() {
  const list = document.getElementById('notesList');
  const errBox = document.getElementById('notesError');
  list.innerHTML = '';
  errBox.textContent = '';
  try {
    const data = await fetchJson('/api/notes');
    if (!Array.isArray(data.notes) || data.notes.length === 0) {
      list.innerHTML = '<li>Заметок пока нет.</li>';
      return;
    }
    data.notes.slice().reverse().forEach(note => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${note.text}</strong><br/><span>${note.createdAt}</span>`;
      list.appendChild(li);
    });
  } catch (err) {
    errBox.textContent = 'Ошибка загрузки заметок: ' + err.message;
  }
}

document.getElementById('addNoteBtn').addEventListener('click', async () => {
  const input = document.getElementById('noteText');
  const errBox = document.getElementById('notesError');
  const text = input.value.trim();
  errBox.textContent = '';
  if (!text) {
    errBox.textContent = 'Введите текст заметки.';
    return;
  }
  if (text.length > 200) {
    errBox.textContent = 'Текст не должен превышать 200 символов.';
    return;
  }
  try {
    const data = await fetchJson('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    input.value = '';
    await loadNotes();
  } catch (err) {
    errBox.textContent = 'Ошибка: ' + err.message;
  }
});

loadNotes();

