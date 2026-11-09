/* DewIt: no dependencies, no account, no backend. */
'use strict';
const $ = (selector) => document.querySelector(selector);
const TASK_KEY = 'slowday.tasks.v1';
const MUSIC_KEY = 'slowday.music.v1';
let tasks = [];
let filter = 'all';
let editingId = null;
let undoAction = null;
let notificationTimer;

function notify(message, undo = null) {
  clearTimeout(notificationTimer);
  undoAction = undo;
  $('#notification-text').textContent = message;
  $('#undo').hidden = !undo;
  $('#notification').hidden = false;
  notificationTimer = setTimeout(() => { $('#notification').hidden = true; undoAction = null; }, 8000);
}
function saveTasks() {
  try {
    localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
    $('#save-label').textContent = '○ Tasks saved in this browser';
  } catch {
    $('#save-label').textContent = '○ Saving unavailable — tasks are temporary';
    notify('Browser storage is unavailable. Keep this tab open to retain your tasks.');
  }
}
function readTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(TASK_KEY) || '[]');
    if (!Array.isArray(saved) || !saved.every(task => task && typeof task.id === 'string' && typeof task.text === 'string' && task.text.trim() && task.text.length <= 200 && typeof task.done === 'boolean') || new Set(saved.map(t => t.id)).size !== saved.length) throw new Error('Invalid tasks');
    tasks = saved;
  } catch {
    notify('Saved tasks could not be read. New tasks will start a fresh list.');
  }
}
function actionButton(text, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'row-action';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', handler);
  return button;
}
function render() {
  const list = $('#task-list');
  list.replaceChildren();
  const visible = tasks.filter(task => filter === 'all' || (filter === 'completed' ? task.done : !task.done));
  visible.forEach(task => {
    const row = document.createElement('li');
    row.className = 'task-row' + (task.done ? ' done' : '');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = task.done;
    check.setAttribute('aria-label', `Mark ${task.text} ${task.done ? 'incomplete' : 'complete'}`);
    check.addEventListener('change', () => {
      task.done = check.checked;
      const index = visible.indexOf(task);
      saveTasks(); render();
      const boxes = list.querySelectorAll('input[type="checkbox"]');
      (boxes[Math.min(index, boxes.length - 1)] || $('#task-input')).focus();
    });
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.text; // User content is never interpreted as HTML.
    row.append(check, title,
      actionButton('Edit', `Edit ${task.text}`, () => {
        editingId = task.id;
        $('#edit-input').value = task.text;
        $('#edit-dialog').showModal();
        $('#edit-input').focus(); $('#edit-input').select();
      }),
      actionButton('×', `Delete ${task.text}`, () => {
        const index = tasks.indexOf(task);
        tasks.splice(index, 1); saveTasks(); render(); $('#task-input').focus();
        notify('Task deleted.', () => { tasks.splice(Math.min(index, tasks.length), 0, task); saveTasks(); render(); });
      })
    );
    list.append(row);
  });
  const completed = tasks.filter(task => task.done).length;
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  $('#task-total').textContent = tasks.length;
  $('#progress').value = percent;
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-copy').textContent = tasks.length ? `${completed} of ${tasks.length} tasks completed` : 'Your next small step starts here';
  $('#clear-completed').disabled = completed === 0;
  $('#empty').hidden = visible.length !== 0;
  $('#empty h3').textContent = filter === 'completed' ? 'Good things take a first step.' : tasks.length ? 'A little breathing room.' : 'A fresh start.';
  $('#empty p').textContent = filter === 'completed' ? 'Completed tasks will appear here.' : tasks.length ? 'You’re all caught up. Enjoy the moment.' : 'Add your first task and give your day a little direction.';
}
$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('#task-input').value.trim();
  if (!text) { $('#task-input').setCustomValidity('Write a task first.'); $('#task-input').reportValidity(); return; }
  tasks.push({ id: crypto.randomUUID(), text, done: false });
  $('#task-input').value = '';
  if (filter === 'completed') setFilter('all');
  saveTasks(); render(); $('#task-input').focus();
});
$('#task-input').addEventListener('input', () => $('#task-input').setCustomValidity(''));
function setFilter(value) {
  filter = value;
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === value)));
  render();
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
$('#clear-completed').addEventListener('click', () => {
  const removed = tasks.map((task, index) => ({ task, index })).filter(item => item.task.done);
  tasks = tasks.filter(task => !task.done); saveTasks(); render();
  notify(`${removed.length} completed task${removed.length === 1 ? '' : 's'} cleared.`, () => {
    removed.forEach(({ task, index }) => tasks.splice(Math.min(index, tasks.length), 0, task)); saveTasks(); render();
  });
});
$('#undo').addEventListener('click', () => {
  if (undoAction) undoAction();
  clearTimeout(notificationTimer); undoAction = null; $('#notification').hidden = true;
});
$('#cancel-edit').addEventListener('click', () => $('#edit-dialog').close());
$('#edit-form').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('#edit-input').value.trim();
  if (!text) { $('#edit-input').setCustomValidity('Write a task first.'); $('#edit-input').reportValidity(); return; }
  const task = tasks.find(item => item.id === editingId);
  if (task) task.text = text;
  $('#edit-dialog').close(); saveTasks(); render(); $('#task-input').focus();
});
$('#edit-input').addEventListener('input', () => $('#edit-input').setCustomValidity(''));

// Only recognized YouTube URLs can become an iframe source.
function parseYouTube(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL');
  const host = url.hostname.toLowerCase();
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'].includes(host)) throw new Error('Not YouTube');
  const parts = url.pathname.split('/').filter(Boolean);
  const video = host.endsWith('youtu.be') ? parts[0] : url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
  const playlist = url.searchParams.get('list');
  const validVideo = video && /^[a-zA-Z0-9_-]{11}$/.test(video);
  const validList = playlist && /^[a-zA-Z0-9_-]{10,150}$/.test(playlist);
  if (!validVideo && !validList) throw new Error('Missing video or playlist');
  const embed = new URL(`https://www.youtube.com/embed/${validVideo ? video : 'videoseries'}`);
  embed.searchParams.set('playsinline', '1');
  if (validList) { embed.searchParams.set('listType', 'playlist'); embed.searchParams.set('list', playlist); }
  const watch = new URL(validVideo ? 'https://www.youtube.com/watch' : 'https://www.youtube.com/playlist');
  if (validVideo) watch.searchParams.set('v', video);
  if (validList) watch.searchParams.set('list', playlist);
  return { embed: embed.href, watch: watch.href };
}
const playerPlaceholder = $('#player-container').cloneNode(true);
$('#music-form').addEventListener('submit', event => {
  event.preventDefault();
  let source;
  try { source = parseYouTube($('#music-url').value.trim()); }
  catch { $('#music-error').textContent = 'Paste a valid YouTube video or playlist link.'; return; }
  $('#music-error').textContent = '';
  const iframe = document.createElement('iframe');
  iframe.title = 'YouTube music player'; iframe.src = source.embed;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  $('#player-container').replaceChildren(iframe);
  $('#open-youtube').href = source.watch;
  $('#open-youtube').textContent = 'Open this on YouTube ↗';
  $('#stop-music').hidden = false;
  try { localStorage.setItem(MUSIC_KEY, $('#music-url').value.trim()); } catch { /* Music remains usable without storage. */ }
});
$('#stop-music').addEventListener('click', () => {
  $('#player-container').replaceChildren(...Array.from(playerPlaceholder.childNodes).map(node => node.cloneNode(true)));
  $('#stop-music').hidden = true;
});
try { $('#music-url').value = localStorage.getItem(MUSIC_KEY) || ''; } catch { /* Optional preference. */ }
$('#date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
readTasks(); render();
