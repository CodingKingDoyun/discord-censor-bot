#!/usr/bin/env bash
# Termux 실행 스크립트: 화면이 꺼져도 동작하도록 wake lock 을 잡고, 봇이 죽으면 자동으로 재시작한다.
# 사용법: tmux new -s censor 'bash scripts/start.sh'

cd "$(dirname "$0")/.." || exit 1
trap 'echo "[start.sh] 종료합니다."; exit 0' INT TERM

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock
fi

while true; do
  npm start
  code=$?
  echo "[start.sh] 봇이 종료되었습니다 (exit ${code}). 5초 후 재시작합니다..."
  sleep 5
done
