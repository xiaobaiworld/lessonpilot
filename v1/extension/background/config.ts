/**
 * API 地址由构建期注入，运行时不可改（4F）。
 *
 * __API_ORIGIN__ 在 vite.config.ts 里按构建目标替换成字面量。
 * 不从存储读、不从消息接受、不按 location 猜 —— 任何一条都等于让
 * 插件可以被指向任意服务器。
 */
declare const __API_ORIGIN__: string;

export const API_ORIGIN: string = __API_ORIGIN__;
