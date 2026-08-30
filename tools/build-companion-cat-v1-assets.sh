#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
source_dir="$repo_root/docs/superpowers/assets/companion/cat-v1/source"
processed_dir="$repo_root/docs/superpowers/assets/companion/cat-v1/processed"
runtime_dir="$repo_root/v1/extension/assets/companion/cat/v1"

for command in cwebp ffmpeg; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "缺少资源构建命令：$command" >&2
    exit 1
  fi
done

for source_file in \
  "$source_dir/idle-master.png" \
  "$source_dir/focus-master.png" \
  "$source_dir/prompt-master.png" \
  "$source_dir/correct-master.png" \
  "$source_dir/wrong-master.png" \
  "$source_dir/complete-master.png" \
  "$source_dir/fish-treat-master.png" \
  "$processed_dir/real-meow-happy-short.wav" \
  "$processed_dir/real-meow-natural-short.wav" \
  "$processed_dir/wrong-soft.wav" \
  "$processed_dir/real-tiger-roar-first-3s.wav"; do
  if [[ ! -f "$source_file" ]]; then
    echo "缺少角色包源文件：$source_file" >&2
    exit 1
  fi
done

image_states=(idle focus prompt correct wrong complete)
for state in "${image_states[@]}"; do
  cwebp -quiet -q 70 "$source_dir/${state}-master.png" -o "$runtime_dir/${state}.webp"
done
cwebp -quiet -q 70 -resize 64 64 "$source_dir/fish-treat-master.png" -o "$runtime_dir/fish-treat.webp"

encode_audio() {
  ffmpeg -hide_banner -loglevel error -y -i "$1" -map_metadata -1 \
    -ac 1 -ar 48000 -c:a libopus -b:a 48k -vbr on -compression_level 10 "$2"
}

encode_audio "$processed_dir/real-meow-happy-short.wav" "$runtime_dir/focus.ogg"
encode_audio "$processed_dir/real-meow-natural-short.wav" "$runtime_dir/prompt.ogg"
encode_audio "$processed_dir/real-meow-happy-short.wav" "$runtime_dir/correct.ogg"
encode_audio "$processed_dir/wrong-soft.wav" "$runtime_dir/wrong.ogg"
encode_audio "$processed_dir/real-tiger-roar-first-3s.wav" "$runtime_dir/complete.ogg"

rm -f \
  "$runtime_dir/idle.png" \
  "$runtime_dir/focus.png" \
  "$runtime_dir/prompt.png" \
  "$runtime_dir/correct.png" \
  "$runtime_dir/wrong.png" \
  "$runtime_dir/complete.png" \
  "$runtime_dir/fish-treat.png" \
  "$runtime_dir/focus.wav" \
  "$runtime_dir/prompt.wav" \
  "$runtime_dir/correct.wav" \
  "$runtime_dir/wrong.wav" \
  "$runtime_dir/complete.wav"

echo "cat-v1 运行资源已生成：$runtime_dir"
