#!/bin/bash
# Render penuh selari (4 proses) lepas tu cantum. Output: dashboard-scroll.mp4
set -e
cd "$(dirname "$0")"
export PLAYWRIGHT_PATH=${PLAYWRIGHT_PATH:-playwright}
TOTAL=$((108*30)); N=4; STEP=$((TOTAL/N))
mkdir -p parts; rm -f parts/*
for i in $(seq 0 $((N-1))); do
  node render.mjs part $((i*STEP)) $(((i+1)*STEP)) parts/p$i.mp4 &
done
wait
for i in $(seq 0 $((N-1))); do echo "file 'p$i.mp4'"; done > parts/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i parts/list.txt -c copy dashboard-scroll.mp4
echo done
