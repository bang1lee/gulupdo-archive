/**
 * Cloudflare Pages Function — /api/lab-stream
 * Generative UI 실험실(lab.html)용 프롬프트 → 프레임 플랜 합성기.
 *
 * 역할:
 *   1. 클라이언트에서 받은 query/path 컨텍스트를 LTX-2 프롬프트로 합성
 *   2. hit-zone 좌표(클릭 가능 영역) 6개를 결정해서 응답
 *   3. (선택) 환경변수에 Modal/LTX 추론 엔드포인트가 있으면 그쪽으로 위임
 *
 * 환경변수:
 *   LAB_LTX_ENDPOINT   — Modal에서 띄운 LTX-2 추론 서버 URL (HTTP, plan 합성용)
 *   LAB_LTX_KEY        — 위 서버 인증용 토큰
 *
 * 실제 비디오 프레임 스트리밍은 lab.html이 별도 wss://endpoint(=meta name="lab-ws-endpoint")로 직접 접속합니다.
 * 이 라우트는 "어떤 일러스트를 그릴지"의 메타데이터만 책임집니다.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  const query = sanitize(body?.query, 500);
  const pathArr = Array.isArray(body?.path) ? body.path.slice(0, 12).map(p => sanitize(p, 80)) : [];
  if (!query) return json({ ok: false, error: 'query required' }, 400);

  // 1) Modal/LTX 백엔드가 있으면 위임 (실제 LTX 프롬프트 합성 + 시드 일러스트 결정)
  if (env.LAB_LTX_ENDPOINT) {
    try {
      const r = await fetch(env.LAB_LTX_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.LAB_LTX_KEY ? { 'Authorization': `Bearer ${env.LAB_LTX_KEY}` } : {}),
        },
        body: JSON.stringify({ query, path: pathArr }),
      });
      if (r.ok) {
        const upstream = await r.json();
        return json({ ok: true, source: 'ltx', ...upstream });
      }
    } catch (err) {
      console.warn('LTX upstream failed, falling back:', err);
    }
  }

  // 2) 폴백: 결정적 mock plan (질문 + 경로 → hash → 6개 hit-zone)
  return json(buildMockPlan(query, pathArr));
}

// ============================================================
// Plan synthesis (fallback / dev mode)
// ============================================================

function buildMockPlan(query, pathArr) {
  const seed = hash32(query + '|' + pathArr.join('/'));
  const W = 1920, H = 1080;
  const padX = 80, padY = 220, gap = 36;
  const cols = 3, rows = 2;
  const w = (W - padX * 2 - gap * (cols - 1)) / cols;
  const h = (H - padY - gap * (rows - 1) - 80) / rows;

  const palette = pickFacets(query);
  const zones = [];
  for (let i = 0; i < cols * rows; i++) {
    const facet = palette[(seed + i) % palette.length];
    const r = Math.floor(i / cols), c = i % cols;
    zones.push({
      id: facet.id,
      label: `${truncate(query, 28)} — ${facet.title}`,
      note: facet.note,
      x: Math.round(padX + c * (w + gap)),
      y: Math.round(padY + r * (h + gap)),
      w: Math.round(w),
      h: Math.round(h),
    });
  }

  return {
    ok: true,
    source: 'mock',
    title: truncate(query, 58),
    caption: pathArr.length ? '/ ' + pathArr.join(' / ') : 'generative ui · streaming preview',
    width: W, height: H, fps: 24,
    prompt_for_ltx: composeLtxPrompt(query, pathArr),
    zones,
  };
}

/** 질문 키워드에 따라 hit-zone 라벨 후보를 살짝 바꿔 실제 인포그래픽처럼 보이게 한다. */
function pickFacets(query) {
  const q = query.toLowerCase();
  const tech = [
    { id: 'soc',    title: 'SoC',    note: '연산의 두뇌. AP/CPU/GPU/NPU 통합 칩' },
    { id: 'memory', title: 'Memory', note: 'RAM/스토리지가 데이터를 잠시·오래 보관' },
    { id: 'sense',  title: 'Sense',  note: '카메라·자이로·터치가 세계를 디지털로' },
    { id: 'radio',  title: 'Radio',  note: '5G/Wi-Fi/BT 모뎀이 전파로 연결' },
    { id: 'power',  title: 'Power',  note: '배터리·PMIC가 전력을 분배' },
    { id: 'panel',  title: 'Panel',  note: 'OLED/LCD가 픽셀로 정보를 출력' },
  ];
  const island = [
    { id: 'jurassic', title: 'Jurassic', note: '약 9천만 년 전 화산활동의 흔적' },
    { id: 'tafoni',   title: 'Tafoni',   note: '풍화 구멍이 만든 벌집 지형' },
    { id: 'biota',    title: 'Biota',    note: '점박이물범·검은머리물떼새 서식' },
    { id: 'history',  title: 'History',  note: '1994 핵폐기장 저지의 시민사' },
    { id: 'wind',     title: 'Wind',     note: '2026 해상풍력 갈등 지점' },
    { id: 'protect',  title: 'Protect',  note: '지질·생태 보전을 위한 지정 노력' },
  ];
  const generic = [
    { id: 'core',   title: 'Core',   note: '핵심 개념의 정의와 범위' },
    { id: 'origin', title: 'Origin', note: '어떻게 시작되었는가' },
    { id: 'flow',   title: 'Flow',   note: '내부에서 무엇이 어떻게 흐르는가' },
    { id: 'edge',   title: 'Edge',   note: '경계·예외·한계 지점' },
    { id: 'risk',   title: 'Risk',   note: '실패·부작용 가능성' },
    { id: 'next',   title: 'Next',   note: '다음으로 이어지는 질문' },
  ];

  if (/스마트폰|phone|soc|chip|반도체|cpu|gpu/.test(q)) return tech;
  if (/굴업도|굴업|gulupdo|gulup|섬|island|핵폐기|풍력|지질/.test(q)) return island;
  return generic;
}

function composeLtxPrompt(query, pathArr) {
  const ctx = pathArr.length ? `Context path: ${pathArr.join(' / ')}. ` : '';
  return (
    `Editorial infographic illustration explaining: "${query}". ${ctx}` +
    `Soft cinematic lighting, deep ocean teal background (#0A1A22), warm rust accents (#D4B896), ` +
    `flat-3D vector style with subtle grain. Six labeled focus zones laid out in a 3x2 grid, ` +
    `each with a title and a one-line caption. Korean and English text crisp at 1080p. ` +
    `No people unless asked, no logos, no watermarks.`
  );
}

// ============================================================
// utils
// ============================================================

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}
function sanitize(text, max) {
  return String(text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max);
}
function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
