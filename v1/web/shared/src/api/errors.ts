import { APIError } from './types';

/** 把任意异常转成给用户看的一句话。 */
export function errorMessage(error: unknown): string {
  if (!(error instanceof APIError)) {
    return '发生未知错误，请重试';
  }

  switch (error.type) {
    case 'ClientError':
      // 后端返回的业务提示优先，它比通用文案具体
      return error.message !== 'ClientError' ? error.message : '请求被拒绝，请检查输入';
    case 'ServerError':
      return '服务出错，请稍后重试';
    case 'NetworkError':
      return '无法连接服务，请检查网络';
    default:
      return '发生未知错误，请重试';
  }
}
