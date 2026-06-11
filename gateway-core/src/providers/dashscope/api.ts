import { ProviderAPIConfig } from '../types';

export const dashscopeAPIConfig: ProviderAPIConfig = {
  // 默认使用国内站端点（国内 Key 必须用此端点，国际 Key 需改为 dashscope-intl）
  // 可通过 x-onellm-dashscope-base-url 头覆盖（也兼容旧 x-aihub-dashscope-base-url）
  getBaseURL: ({ providerOptions }) => {
    const customBase = providerOptions?.dashscopeBaseUrl;
    if (customBase) return customBase;
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  },
  headers({ providerOptions }) {
    const { apiKey } = providerOptions;
    return { Authorization: `Bearer ${apiKey}` };
  },
  getEndpoint({ fn }) {
    switch (fn) {
      case 'chatComplete':
        return `/chat/completions`;
      case 'embed':
        return `/embeddings`;
      default:
        return '';
    }
  },
};
