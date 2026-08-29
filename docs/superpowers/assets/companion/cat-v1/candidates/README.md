# 小猫真实声音候选

这些文件是从公开声音页面下载的试听原始候选，不直接作为插件运行时资源。正式使用前，先在 `processed/` 中裁剪、淡入淡出、响度标准化，并将来源页面与许可证保留在角色包清单中。

## 候选来源

| 本地文件 | 内容 | 来源 | 许可 | 备注 |
| --- | --- | --- | --- | --- |
| `real-meow-happy.mp3` | 真实家猫 Tori 的短叫声 | [alizardguy / Freesound](https://freesound.org/people/alizardguy/sounds/668632/) | CC0 1.0 | 用于 `focus`、`correct` |
| `real-meow-natural.mp3` | 真实家猫自然叫声 | [Richard1052 / Freesound](https://freesound.org/people/Richard1052/sounds/585766/) | CC0 1.0 | 从尾部截取短片段后用于 `prompt`、低音量 `wrong` |
| `real-purr.mp3` | 真实家猫呼噜声 | [JamesBradford / Freesound](https://freesound.org/people/JamesBradford/sounds/579898/) | CC0 1.0 | 从中段截取，作为备用完成/等待声音 |
| `real-hiss.mp3` | 真实家猫哈气声 | [Zabuhailo / Freesound](https://freesound.org/people/Zabuhailo/sounds/146963/) | CC0 1.0 | 暂不进入当前小猫包，避免答错反馈过于惊吓 |
| `real-tiger-roar.mp3` | Louisville Zoo 老虎吼声实录 | [lauramellis / Freesound](https://freesound.org/people/lauramellis/sounds/263115/) | CC0 1.0 | 取前 3 秒，作为当前 `complete` 庆祝声音 |

## 当前处理结果

- 开心叫声：从开头保留 `0.60s`，首尾做短淡入淡出。
- 自然叫声：从原始录音尾部截取 `1.10s`，首尾做短淡入淡出，避开前段空白。
- 呼噜声：从原始录音约 `16.00s` 处开始截取 `2.80s`，避开开头空白，作为备用声音。
- 老虎声：从录音开头保留 `3.00s`，作为 `complete` 庆祝声音。
- 答错状态：沿用自然叫声尾部短片段并降低音量，不使用哈气声。
- 插件运行时统一输出为单声道 `48kHz` `16-bit WAV`，并保留原始候选不覆盖。
