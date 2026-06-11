import { ProviderAPIConfig } from '../types';

const MiniMaxAPIConfig: ProviderAPIConfig = {
  getBaseURL: () => 'https://api.minimax.chat',
  headers: ({ providerOptions }) => {
    return { Authorization: `Bearer ${providerOptions.apiKey}` };
  },
  getEndpoint: ({ fn }) => {
    switch (fn) {
      case 'chatComplete':
        return '/v1/chat/completions';
      default:
        return '';
    }
  },
};

export default MiniMaxAPIConfig;
