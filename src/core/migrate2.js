// 2.0.0 으로 옮기기 (한 번만). 그날의 기분 · 먹고 싶은 것 · 오늘의 소식을 없앴다.
//  - 지운 모션을 산 값은 shop.migrate 가 돌려준다 (RETIRED_MOTIONS). 남은 모션은 이제 공짜라 돌려주지 않는다
//  - 없앤 기능의 기록은 data.json 에서 지운다
// 2.2.0: 동네 친구 · 보물 공방이 돌아왔다 (이슈 #9). 1.x 에서 바로 올라온 사람의 보물 · 친구 · 바닥 보물 · 공방 기록은
//  이제 코인으로 바꾸지도 지우지도 않고 그대로 둔다. 2.0 · 2.1 에서 이미 옮긴 사람은 2.x 그대로 두고 두 기능을 새로 시작한다
// state 는 plugin/store.js 의 Store. 무엇을 했는지 돌려준다 (이미 옮겼으면 null)
const GONE_STATE = ['craving', 'temper', 'news'];

function migrateV2(state) {
  if (state.get('v2')) return null;
  const out = { removed: GONE_STATE.filter((k) => k in state.data) };
  state.set({ v2: true });
  for (const k of GONE_STATE) delete state.data[k];
  state.saveSoon();
  return out;
}

module.exports = { migrateV2, GONE_STATE };
