# KnownMap 教师平台数据规范旧入口

更新时间：2026-08-20

状态：已由统一数据文档替代，仅保留兼容入口。

当前数据事实源：

- [`data-spec.md`](data-spec.md)：数据规范总入口；
- [`data/model.md`](data/model.md)：当前和目标数据模型；
- [`data/dictionary.md`](data/dictionary.md)：数据库、API、插件和文件字段字典；
- [`data/flow.md`](data/flow.md)：数据流、失败处理和血缘；
- [`data/quality.md`](data/quality.md)：数据质量、已知漂移和验证门禁。

旧文档曾只覆盖教师平台数据库和插件输出，无法继续表达字幕、Chrome 本地学习状态、生产
release JSON，以及 D-023 至 D-025 的目标模型。所有新数据变更应更新上述统一入口，不再向
本文件追加字段。
