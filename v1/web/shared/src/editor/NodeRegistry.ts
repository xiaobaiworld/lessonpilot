/**
 * 节点注册表 (TypeScript + React)
 * 职责：管理四种节点的元数据、验证规则、渲染 hook
 */

export interface NodeSchema {
  type: 'remark' | 'highlight' | 'question' | 'feedback';
  label: string;
  description: string;
  icon: string;
  color: string;
  requiresAnswer?: boolean;
}

export interface InteractionNode {
  id: string;
  type: NodeSchema['type'];
  startTime: number;
  content: {
    title?: string;
    text?: string;
    options?: Array<{ id: string; text: string }>;
  };
  metadata?: Record<string, unknown>;
}

export class NodeRegistry {
  private schemas: Map<string, NodeSchema>;

  constructor() {
    this.schemas = new Map([
      [
        'remark',
        {
          type: 'remark',
          label: '重点标注',
          description: '重点内容标注，不需要学生回答',
          icon: '📌',
          color: '#fbbf24',
        },
      ],
      [
        'highlight',
        {
          type: 'highlight',
          label: '强调',
          description: '强调内容，吸引学生注意',
          icon: '⭐',
          color: '#ec4899',
        },
      ],
      [
        'question',
        {
          type: 'question',
          label: '选择题',
          description: '学生需要选择正确答案',
          icon: '❓',
          color: '#3b82f6',
          requiresAnswer: true,
        },
      ],
      [
        'feedback',
        {
          type: 'feedback',
          label: '反馈',
          description: '对学生回答的反馈',
          icon: '💬',
          color: '#10b981',
        },
      ],
    ]);
  }

  /**
   * 获取所有节点类型
   */
  getAllTypes(): NodeSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * 获取节点类型信息
   */
  getSchema(type: string): NodeSchema | undefined {
    return this.schemas.get(type);
  }

  /**
   * 验证节点
   */
  validateNode(node: InteractionNode): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const schema = this.schemas.get(node.type);

    if (!schema) {
      errors.push(`未知节点类型: ${node.type}`);
      return { valid: false, errors };
    }

    if (node.startTime < 0) {
      errors.push('起始时间不能为负');
    }

    if (schema.requiresAnswer && !node.content.options?.length) {
      errors.push(`${schema.label}必须包含选项`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 创建新节点
   */
  createNode(
    type: string,
    startTime: number,
    content: InteractionNode['content']
  ): InteractionNode {
    return {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type as NodeSchema['type'],
      startTime,
      content,
    };
  }
}
