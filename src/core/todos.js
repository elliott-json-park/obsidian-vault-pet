// 홈의 할 일 (2.0.0). 플러그인 data.json 안에만 있는 목록이다. 볼트의 노트 · 체크박스는 만들지도 고치지도 않는다.
//  state.todos = [{ id, text, done, at(만든 시각), up(마지막으로 고친 시각), doneAt, counted }]
//  - 끝내면 업적 · 퀘스트용 'todoDone' 이 한 번 오른다. 만든 지 1분이 안 된 할 일, 이미 한 번 센 할 일은 안 센다
//    (만들자마자 끝내기 · 껐다 켜기로 숫자만 올리지 않게)
//  - 지운 할 일은 tomb 에 id 만 잠깐 남겨 둔다. 다른 기기의 목록과 합칠 때 되살아나지 않게 (plugin/sync.js)
const MAX_TODOS = 100;
const MAX_TEXT = 200;
const TOMB_MAX = 200;
const COUNT_AFTER_MS = 60_000;

const clean = (text) => String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
const newId = (now) => now.toString(36) + Math.random().toString(36).slice(2, 6);

class Todos {
  // state 는 plugin/store.js 의 Store. onDone(item) 은 처음 끝낸 할 일마다 (업적 · 퀘스트 숫자)
  constructor(state, onDone = null) {
    this.state = state;
    this.onDone = onDone;
  }

  list() {
    const raw = this.state.get('todos');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string') : [];
  }

  save(list, tomb = null) {
    const patch = { todos: list };
    if (tomb) patch.todoTomb = [...(this.state.get('todoTomb') || []), ...tomb].slice(-TOMB_MAX);
    this.state.set(patch);
  }

  // 화면에 줄 것: 안 끝낸 것 먼저(놓은 순서), 끝낸 것은 끝낸 시각 늦은 순
  summary() {
    const list = this.list();
    const open = list.filter((x) => !x.done);
    const done = list.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    return { open: open.map(view), done: done.map(view), max: MAX_TODOS, maxText: MAX_TEXT };
  }

  add(text, now = Date.now()) {
    const t = clean(text);
    if (!t) return { ok: false, reason: 'empty' };
    const list = this.list();
    if (list.length >= MAX_TODOS) return { ok: false, reason: 'full' };
    const item = { id: newId(now), text: t, done: false, at: now, up: now };
    this.save([...list, item]);
    return { ok: true, item };
  }

  edit(id, text, now = Date.now()) {
    const t = clean(text);
    if (!t) return { ok: false, reason: 'empty' };
    return this.patch(id, { text: t }, now);
  }

  toggle(id, now = Date.now()) {
    const it = this.list().find((x) => x.id === id);
    if (!it) return { ok: false, reason: 'missing' };
    const done = !it.done;
    const count = done && !it.counted && now - (it.at || 0) >= COUNT_AFTER_MS;
    const r = this.patch(id, { done, doneAt: done ? now : null, ...(count ? { counted: true } : {}) }, now);
    if (count && this.onDone) this.onDone(r.item);
    return { ...r, counted: count };
  }

  remove(id) {
    const list = this.list();
    if (!list.some((x) => x.id === id)) return { ok: false, reason: 'missing' };
    this.save(list.filter((x) => x.id !== id), [id]);
    return { ok: true };
  }

  // 끝낸 것 한꺼번에 지우기
  clearDone() {
    const list = this.list();
    const gone = list.filter((x) => x.done).map((x) => x.id);
    if (gone.length) this.save(list.filter((x) => !x.done), gone);
    return { ok: true, n: gone.length };
  }

  // 순서 바꾸기: id 를 안 끝낸 목록의 to 번째로
  move(id, to) {
    const list = this.list();
    const it = list.find((x) => x.id === id);
    if (!it || it.done) return { ok: false, reason: 'missing' };
    const open = list.filter((x) => !x.done && x.id !== id);
    const i = Math.max(0, Math.min(open.length, Math.floor(Number(to) || 0)));
    open.splice(i, 0, it);
    this.save([...open, ...list.filter((x) => x.done)]);
    return { ok: true };
  }

  patch(id, fields, now) {
    const list = this.list();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false, reason: 'missing' };
    const item = { ...list[i], ...fields, up: now };
    list[i] = item;
    this.save(list);
    return { ok: true, item };
  }
}

const view = (x) => ({ id: x.id, text: x.text, done: !!x.done, at: x.at || 0, doneAt: x.doneAt || 0 });

module.exports = { Todos, MAX_TODOS, MAX_TEXT, COUNT_AFTER_MS };
