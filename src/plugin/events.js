// node 의 events 모듈 대신 쓰는 작은 EventEmitter. 모바일 옵시디언에는 node 가 없어서 직접 둔다.
class EventEmitter {
  constructor() {
    this._ev = {};
  }

  on(name, fn) {
    (this._ev[name] ||= []).push(fn);
    return this;
  }

  off(name, fn) {
    const list = this._ev[name];
    if (list) this._ev[name] = list.filter((f) => f !== fn);
    return this;
  }

  once(name, fn) {
    const wrap = (...a) => {
      this.off(name, wrap);
      fn(...a);
    };
    return this.on(name, wrap);
  }

  emit(name, ...args) {
    const list = this._ev[name];
    if (!list || !list.length) return false;
    for (const fn of list.slice()) {
      try {
        fn(...args);
      } catch (e) {
        console.error('[Vault Pet]', name, e);
      }
    }
    return true;
  }

  removeAllListeners() {
    this._ev = {};
  }
}

module.exports = { EventEmitter };
