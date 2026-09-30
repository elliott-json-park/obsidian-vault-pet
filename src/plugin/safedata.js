'use strict';
/*
 * data.json 을 안전하게 읽는다.
 *
 * 옵시디언의 loadData 는 파일이 깨져 있으면(쓰다가 꺼짐·동기화 충돌) 던지고, 그러면 플러그인이 아예 안 켜진다.
 * 그래서 하루에 한 번, 잘 읽힌 data.json 을 data.backup.json 으로 남겨 두고 깨졌을 때 그걸로 되살린다.
 * 깨진 파일은 지우지 않고 data.broken-<시각>.json 으로 옮겨 둔다.
 * '깨졌다'는 읽히긴 하는데 JSON 이 아닐 때만이다. 파일을 아예 못 읽으면(권한·디스크) 그대로 던져서
 * 플러그인이 안 켜지게 둔다 — 잠깐의 읽기 오류로 멀쩡한 파일을 새 고양이로 덮어쓰면 안 된다.
 *
 * adapter 는 옵시디언의 DataAdapter (exists · read · write). 테스트에서는 가짜를 넣는다.
 */
const BACKUP = 'data.backup.json';

// 우리가 쓴 자료인지 (고양이 설정이 들어 있는 객체)
function usable(raw) {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw);
}

async function readJson(adapter, file) {
  if (!(await adapter.exists(file))) return { found: false, raw: null };
  const text = await adapter.read(file);
  if (!String(text).trim()) return { found: true, raw: null, broken: true };
  try {
    const raw = JSON.parse(text);
    return usable(raw) ? { found: true, raw } : { found: true, raw: null, broken: true };
  } catch {
    return { found: true, raw: null, broken: true };
  }
}

/*
 * 돌려주는 것: { raw, source }
 *   source = 'data' (평소) | 'none' (처음 설치) | 'backup' (깨져서 백업으로 되살림) | 'lost' (깨졌고 백업도 없다 → 처음부터)
 */
async function loadSafe(adapter, dir, now = Date.now()) {
  const file = `${dir}/data.json`;
  const main = await readJson(adapter, file);
  if (main.raw) return { raw: main.raw, source: 'data' };
  if (!main.found) return { raw: null, source: 'none' };
  // 깨졌다. 원본부터 남겨 둔다 (이게 안 되면 덮어쓰지 않게 던진다)
  await adapter.write(`${dir}/data.broken-${now}.json`, await adapter.read(file));
  const back = await readJson(adapter, `${dir}/${BACKUP}`).catch(() => ({ raw: null }));
  if (back.raw) return { raw: back.raw, source: 'backup' };
  return { raw: null, source: 'lost' };
}

// 하루에 한 번 백업한다. raw 는 방금 잘 읽힌 자료 (고양이가 있는 것만)
async function backupDaily(adapter, dir, raw, lastDay, today) {
  if (!usable(raw) || !raw.settings || lastDay === today) return false;
  await adapter.write(`${dir}/${BACKUP}`, JSON.stringify(raw));
  return true;
}

module.exports = { loadSafe, backupDaily, BACKUP };
