/**
 * Cloudflare Pages Function — /api/submit
 * 굴업도 아카이브 참여 신청 폼 백엔드
 *
 * 플로우: 검증 → IP 해싱(개인정보 최소화) → D1 저장 → 병렬(텔레그램 알림 + 자동회신)
 *
 * 필수 환경변수 (Cloudflare 대시보드 → Pages → Settings → Environment variables):
 *   DB                  — D1 바인딩 (gulupdo-submissions)
 *   IP_SALT             — IP 해싱용 랜덤 시크릿 (openssl rand -hex 32)
 * 선택 환경변수:
 *   TELEGRAM_BOT_TOKEN  — @BotFather 발급 봇 토큰
 *   TELEGRAM_CHAT_ID    — 운영진 텔레그램 채널/그룹 ID
 *   RESEND_API_KEY      — Resend API 키 (자동회신 메일)
 *   RESEND_FROM         — 발송 주소 (예: "뉴리프 <contact@newleaf.kr>")
 *   NOTIFY_EMAIL        — 운영진 수신 메일 (선택)
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();

    // --- 1. 기본 검증 ---
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 1) {
      return json({ ok: false, error: '이름을 입력해주세요.' }, 400);
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return json({ ok: false, error: '올바른 이메일 주소를 입력해주세요.' }, 400);
    }
    if ((data.message || '').length > 5000) {
      return json({ ok: false, error: '메시지가 너무 깁니다 (최대 5000자).' }, 400);
    }
    // 허니팟 (봇 차단 — 프론트에 숨겨둔 필드가 채워지면 봇)
    if (data.website && data.website.length > 0) {
      return json({ ok: true, message: '접수되었습니다.' }); // 조용히 성공 응답
    }

    // --- 2. IP 해싱 (원본 저장 안 함) ---
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ipHash = env.IP_SALT ? await sha256(ip + env.IP_SALT) : '';

    // --- 3. D1 저장 ---
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO submissions
          (name, email, telegram, org, time_pref, referrer, methods, message, ip_hash, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sanitize(data.name, 100),
        sanitize(data.email, 200),
        sanitize(data.telegram || '', 100) || null,
        sanitize(data.org || '', 200) || null,
        sanitize(data.time || '', 50) || null,
        sanitize(data.referrer || '', 100) || null,
        Array.isArray(data.methods) ? data.methods.join(',').slice(0, 200) : '',
        sanitize(data.message || '', 5000) || null,
        ipHash,
        (request.headers.get('User-Agent') || '').slice(0, 300),
      ).run();
    }

    // --- 4. 병렬: 텔레그램 + 자동회신 메일 ---
    await Promise.allSettled([
      notifyTelegram(env, data),
      sendAutoReply(env, data),
      notifyOps(env, data),
    ]);

    return json({
      ok: true,
      message: '신청이 접수되었습니다. 48시간 이내 뉴리프 운영진이 연락드립니다.',
    });
  } catch (err) {
    console.error('submit error:', err);
    return json({ ok: false, error: '일시적 오류가 발생했습니다. 다시 시도해주세요.' }, 500);
  }
}

// ============================================================
// Helpers
// ============================================================

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

function sanitize(text, max) {
  return String(text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max);
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function notifyTelegram(env, data) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const methods = Array.isArray(data.methods) && data.methods.length
    ? data.methods.join(', ')
    : '(선택 없음)';
  const text =
    `🌊 *굴업도 아카이브 신규 신청*\n\n` +
    `*이름*: ${escape(data.name)}\n` +
    `*이메일*: ${escape(data.email)}\n` +
    `*텔레그램*: ${escape(data.telegram || '-')}\n` +
    `*소속*: ${escape(data.org || '-')}\n` +
    `*연락 시간*: ${escape(data.time || '-')}\n` +
    `*유입 경로*: ${escape(data.referrer || '-')}\n` +
    `*참여 방식*: ${escape(methods)}\n` +
    (data.message ? `\n*메시지*:\n${escape(data.message).slice(0, 800)}` : '');
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  }).catch(() => {});
}

function escape(s) {
  return String(s || '').replace(/[_*\[\]()~`>#+\-=|{}.!]/g, m => '\\' + m);
}

async function sendAutoReply(env, data) {
  if (!env.RESEND_API_KEY) return;
  const from = env.RESEND_FROM || '뉴리프 <onboarding@resend.dev>';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [data.email],
      subject: '[뉴리프] 굴업도 아카이브 참여 신청이 접수되었습니다',
      html: autoReplyHtml(data.name),
    }),
  }).catch(() => {});
}

async function notifyOps(env, data) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return;
  const from = env.RESEND_FROM || '뉴리프 알림 <onboarding@resend.dev>';
  const methods = Array.isArray(data.methods) ? data.methods.join(', ') : '';
  const body = `
    <div style="font-family:-apple-system,sans-serif;line-height:1.6;padding:16px">
      <h3>굴업도 아카이브 신규 신청</h3>
      <ul>
        <li><strong>이름</strong>: ${esc(data.name)}</li>
        <li><strong>이메일</strong>: ${esc(data.email)}</li>
        <li><strong>텔레그램</strong>: ${esc(data.telegram || '-')}</li>
        <li><strong>소속</strong>: ${esc(data.org || '-')}</li>
        <li><strong>연락 시간</strong>: ${esc(data.time || '-')}</li>
        <li><strong>유입 경로</strong>: ${esc(data.referrer || '-')}</li>
        <li><strong>참여 방식</strong>: ${esc(methods)}</li>
        <li><strong>메시지</strong>: <pre style="white-space:pre-wrap">${esc(data.message || '-')}</pre></li>
      </ul>
    </div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [env.NOTIFY_EMAIL],
      subject: `[뉴리프] 신규 신청 · ${data.name}`,
      html: body,
      reply_to: data.email,
    }),
  }).catch(() => {});
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function autoReplyHtml(name) {
  return `
<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:0;background:#f4ece0;font-family:-apple-system,'Pretendard',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;background:#fff">
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#7DBE8E,#5D8C6A);margin-bottom:12px"></div>
      <div style="font-weight:700;letter-spacing:.05em;color:#132a36">NEWLEAF · 뉴리프</div>
    </div>
    <h2 style="color:#132a36;font-size:22px;line-height:1.4;margin:0 0 20px">
      ${esc(name)}님, 굴업도 아카이브에 함께해 주셔서 감사합니다.
    </h2>
    <p style="color:#2a3e4a;font-size:15px;line-height:1.7;margin:0 0 16px">
      신청이 정상 접수되었습니다. <strong>48시간 이내</strong> 운영진이 직접 연락드리겠습니다.
    </p>
    <p style="color:#2a3e4a;font-size:15px;line-height:1.7;margin:0 0 16px">
      1994년 핵폐기장을 막았던 시민의 힘으로,<br>이번에는 굴업도를 영구적으로 지킬 차례입니다.
    </p>
    <div style="margin:32px 0;padding:20px;background:#f4ece0;border-left:3px solid #8E735B">
      <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:.2em;color:#8E735B;text-transform:uppercase;margin-bottom:8px">
        다음 단계
      </div>
      <ol style="margin:0;padding-left:20px;color:#2a3e4a;font-size:14px;line-height:1.8">
        <li>운영진이 신청 내용 검토 (최대 48시간)</li>
        <li>선택하신 참여 방식에 따라 담당 매니저가 개별 메일</li>
        <li>탐방 일정·의견서 템플릿·후원 방법 안내</li>
      </ol>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.6;margin:0">
      이 메일은 자동 발송되었습니다.<br>
      답장은 <a href="mailto:contact@newleaf.kr" style="color:#8E735B">contact@newleaf.kr</a>로 부탁드립니다.
    </p>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0">
    <p style="color:#999;font-size:11px;text-align:center;margin:0">
      © 2026 사단법인 뉴리프 · NewLeaf<br>
      굴업도 생태 아카이브 프로젝트
    </p>
  </div>
</body></html>`;
}
