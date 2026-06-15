import { ProviderConfigs } from '../types';
import DeepSeekAPIConfig from './api';
import {
  DeepSeekChatCompleteConfig,
  DeepSeekChatCompleteResponseTransform,
  DeepSeekChatCompleteStreamChunkTransform,
} from './chatComplete';
import { messagesBaseConfig } from '../anthropic-base/messages';

const DeepSeekConfig: ProviderConfigs = {
  chatComplete: DeepSeekChatCompleteConfig,
  messages: messagesBaseConfig,
  messagesCountTokens: messagesBaseConfig,
  api: DeepSeekAPIConfig,
  responseTransforms: {
    chatComplete: DeepSeekChatCompleteResponseTransform,
    'stream-chatComplete': DeepSeekChatCompleteStreamChunkTransform,
  },
};

export default DeepSeekConfig;
