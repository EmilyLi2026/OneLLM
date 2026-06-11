import { ProviderAPIConfig } from '../types';

const XunfeiSparkAPIConfig: ProviderAPIConfig = {
  getBaseURL: () => 'https://spark-api-open.xf-yun.com/v1',
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

export default XunfeiSparkAPIConfig;
