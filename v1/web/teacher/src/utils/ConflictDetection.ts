/**
 * 冲突检测和恢复
 */

export interface ConflictState {
  hasConflict: boolean;
  serverRevision: number;
  localRevision: number;
  reason: string;
}

export class ConflictDetector {
  /**
   * 检测编辑冲突
   */
  detectConflict(
    localRevision: number,
    serverRevision: number
  ): ConflictState {
    return {
      hasConflict: localRevision !== serverRevision,
      serverRevision,
      localRevision,
      reason:
        localRevision < serverRevision
          ? '课程已被他人修改，你的编辑可能过期'
          : '版本号异常',
    };
  }

  /**
   * 生成冲突恢复选项
   */
  getRecoveryOptions(conflict: ConflictState) {
    return [
      {
        id: 'reload',
        label: '重新加载',
        description: '丢弃本地更改，加载最新版本',
        destructive: true,
      },
      {
        id: 'continue',
        label: '继续编辑',
        description: '继续用本地版本编辑（可能发布失败）',
        destructive: false,
      },
    ];
  }
}
