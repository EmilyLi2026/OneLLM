import { ProviderAPIConfig } from '../types';

const BaichuanAPIConfig: ProviderAPIConfig = {
  getBaseURL: () => 'https://api.baichuan-ai.com/v1',
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

export default BaichuanAPIConfig;
