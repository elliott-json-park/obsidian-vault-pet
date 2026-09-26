// 펫 무대. 킷커밋 데스크톱판의 '화면 전체를 덮는 투명한 펫 창' 자리.
// 옵시디언 작업 영역(.workspace) 위에 투명한 iframe 을 한 장 덮는다. 바닥은 작업 영역 맨 아래(상태 표시줄 바로 위)다.
//
// 클릭 통과: 데스크톱판은 setIgnoreMouseEvents(true, { forward: true }) 로 클릭은 뒤 창에 넘기고 마우스 움직임만 받았다.
// 여기서는 iframe 을 pointer-events: none 으로 두고, 옵시디언 쪽에서 받은 mousemove 를 iframe 안으로 흘려 넣는다.
// 고양이·말풍선·장난감 위에 올라가면 펫 창이 hover(true) 를 보내고, 그때만 iframe 이 마우스를 받는다.
const { KitFrame } = require('./frame');

class PetStage {
  constructor(plugin, host) {
    this.plugin = plugin;
    this.host = host;
    this.el = null;
    this.frame = null;
    this.hidden = false;
    this.interactive = false;
    this.mouse = null; // 마지막 마우스 자리 (옵시디언 창 좌표)
    this.cleanup = [];
  }

  mount() {
    if (this.el) return;
    const doc = document;
    const el = doc.body.createDiv({ cls: 'kitcommit-stage' });
    this.el = el;
    this.fit();
    const frame = new KitFrame(this.host, 'pet');
    frame.mount(el, { fontCss: this.plugin.fontCss(), dark: this.plugin.isDark() });
    this.frame = frame;
    this.setInteractive(false);
    this.host.attachPet(frame);

    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this.cleanup.push(() => target.removeEventListener(type, fn, opts));
    };
    // 옵시디언 위에서 움직인 마우스를 펫 창으로 흘려 넣는다 (펫 창이 마우스를 안 받는 동안만)
    on(doc, 'mousemove', (e) => this.forward(e), { capture: true, passive: true });
    on(doc.documentElement, 'mouseleave', () => this.leave(), { passive: true });
    on(window, 'blur', () => this.leave());
    // 펫 창이 직접 받는 마우스 (고양이 위). 우클릭 메뉴를 띄울 자리를 기억한다
    const fw = frame.win;
    const own = (e) => {
      const r = this.rect();
      this.mouse = { x: r.left + e.clientX, y: r.top + e.clientY };
    };
    fw.addEventListener('mousemove', own, { passive: true });
    fw.addEventListener('mousedown', own, { passive: true });
    fw.addEventListener('contextmenu', own, { capture: true });
    // 데스크톱판 펫 창은 포커스를 안 가져갔다(focusable: false). 고양이를 눌러도 쓰던 노트에서 커서가 빠지지 않게 되돌려 준다
    fw.addEventListener('mousedown', () => {
      const a = doc.activeElement;
      this.prevFocus = a && a !== doc.body && a !== frame.iframe ? a : null;
    }, { capture: true });
    fw.addEventListener('mouseup', () => {
      const prev = this.prevFocus;
      this.prevFocus = null;
      // 친구 카드의 글자 칸처럼 펫 창 안에서 글을 쓰는 곳이면 그대로 둔다
      const inner = fw.document.activeElement;
      if (inner && ['INPUT', 'TEXTAREA', 'SELECT'].includes(inner.tagName)) return;
      if (prev && prev.isConnected) setTimeout(() => prev.focus({ preventScroll: true }), 0);
    }, { capture: true });
    // 크기: 작업 영역이 바뀔 때마다 맞춘다 (사이드바 열고 닫기·창 크기)
    const ws = doc.querySelector('.workspace');
    if (ws && window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.fit());
      ro.observe(ws);
      this.cleanup.push(() => ro.disconnect());
    }
    on(window, 'resize', () => this.fit());
  }

  unmount() {
    for (const f of this.cleanup) f();
    this.cleanup = [];
    this.host.detachPet();
    if (this.frame) this.frame.destroy();
    this.frame = null;
    if (this.el) this.el.remove();
    this.el = null;
  }

  // 작업 영역에 맞춘다. 바닥은 상태 표시줄 바로 위 (데스크톱판의 '작업표시줄 바로 위')
  rect() {
    const ws = document.querySelector('.workspace');
    if (ws) {
      const r = ws.getBoundingClientRect();
      if (r.width > 50 && r.height > 50) {
        const sb = document.querySelector('.status-bar');
        const sr = sb && sb.offsetParent ? sb.getBoundingClientRect() : null;
        const bottom = sr && sr.height && sr.top < r.bottom && sr.top > r.top + r.height / 2 ? sr.top : r.bottom;
        return { left: r.left, top: r.top, width: r.width, height: bottom - r.top, right: r.right, bottom };
      }
    }
    const sb = document.querySelector('.status-bar');
    const h = window.innerHeight - (sb ? sb.getBoundingClientRect().height : 0);
    return { left: 0, top: 0, width: window.innerWidth, height: h, right: window.innerWidth, bottom: h };
  }

  fit() {
    if (!this.el) return;
    const r = this.rect();
    Object.assign(this.el.style, { left: `${Math.round(r.left)}px`, top: `${Math.round(r.top)}px`, width: `${Math.round(r.width)}px`, height: `${Math.round(r.height)}px` });
  }

  forward(e) {
    if (!this.frame || !this.frame.win || this.hidden) return;
    const r = this.rect();
    this.mouse = { x: e.clientX, y: e.clientY };
    // 펫 창이 직접 받고 있으면 흘려 넣지 않는다 (같은 움직임이 두 번 들어간다)
    if (this.interactive && e.target && e.target.ownerDocument === this.frame.win.document) return;
    const inside = e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
    if (!inside) return this.leave();
    this.outside = false;
    const W = this.frame.win;
    try {
      const ev = new W.MouseEvent('mousemove', {
        clientX: e.clientX - r.left,
        clientY: e.clientY - r.top,
        screenX: e.screenX,
        screenY: e.screenY,
        buttons: e.buttons,
        bubbles: true,
        cancelable: true,
      });
      W.document.dispatchEvent(ev);
    } catch {
      // 펫 창이 막 닫히는 중
    }
  }

  // 마우스가 무대를 벗어났다 (펫 창의 window 'mouseleave')
  // 펫 창이 마우스를 받고 있을 때(고양이 위)는 옵시디언 쪽 mouseleave 가 '펫 창으로 들어갔다'는 뜻이라 흘려 넣지 않는다.
  // 그때는 펫 창이 자기 mouseleave 를 직접 받는다
  leave() {
    if (this.interactive || this.outside || !this.frame || !this.frame.win) return;
    this.outside = true;
    try {
      this.frame.win.dispatchEvent(new this.frame.win.MouseEvent('mouseleave'));
    } catch {
      // 무시
    }
  }

  setInteractive(v) {
    this.interactive = !!v;
    if (this.frame && this.frame.iframe) this.frame.iframe.style.pointerEvents = v ? 'auto' : 'none';
  }

  setHidden(v) {
    this.hidden = !!v;
    if (this.el) this.el.style.display = v ? 'none' : '';
    if (v) this.setInteractive(false);
  }

  visible() {
    return !!this.el && !this.hidden;
  }

  lastMouse() {
    return this.mouse || { x: window.innerWidth - 160, y: window.innerHeight - 160 };
  }
}

module.exports = { PetStage };
