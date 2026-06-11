import { ProviderConfigs } from '../types';
import ByteDanceAPIConfig from './api';
import {
  ByteDanceChatCompleteConfig,
  ByteDanceChatCompleteResponseTransform,
  ByteDanceChatCompleteStreamChunkTransform,
} from './chatComplete';

const ByteDanceConfig: ProviderConfigs = {
  chatComplete: ByteDanceChatCompleteConfig,
  api: ByteDanceAPIConfig,
  responseTransforms: {
    chatComplete: ByteDanceChatCompleteResponseTransform,
    'stream-chatComplete': ByteDanceChatCompleteStreamChunkTransform,
  },
};

export default ByteDanceConfig;
