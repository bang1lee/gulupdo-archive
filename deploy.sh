#!/bin/bash
# 굴업도 아카이브 · Cloudflare Pages 수동 배포 스크립트
# 사용: ./deploy.sh  (또는 bash deploy.sh)

set -e
cd "$(dirname "$0")"

echo "🌊 굴업도 아카이브 배포 시작..."
echo ""

# Git 커밋 (선택 · 실패해도 진행)
if git diff --quiet && git diff --cached --quiet; then
  echo "📌 변경사항 없음 — 코드 업로드만 진행"
else
  echo "📝 변경사항 감지 — 커밋 안내:"
  git status --short
  echo ""
  read -p "커밋 메시지 (비워두면 자동): " msg
  msg="${msg:-update: 콘텐츠 수정}"
  git add -A
  git commit -m "$msg" || true
  git push origin main || echo "⚠️  Git push 실패 (계속 진행)"
  echo ""
fi

echo "🚀 Cloudflare Pages 배포..."
npx wrangler pages deploy . --project-name gulupdo-archive --branch main --commit-dirty=true

echo ""
echo "✅ 완료 → https://gulupdo-archive.pages.dev"
