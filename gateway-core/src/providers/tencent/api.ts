import { ProviderAPIConfig } from '../types';

const TencentHunyuanAPIConfig: ProviderAPIConfig = {
  getBaseURL: () => 'https://api.hunyuan.cloud.tencent.com/v1',
  headers: ({ providerOptions }) => {
    return { Authorization: `Bearer ${providerOptions.apiKey}` };
  },
  getEndpoint: ({ fn }) => {
    switch (fn) {
      case 'chatComplete':
        return '/chat/completions';
      default:
        return '';
    }
  },
};

export default TencentHunyuanAPIConfig;
