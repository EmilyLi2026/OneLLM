import { ProviderConfigs } from '../types';
import TencentAPIConfig from './api';
import {
  TencentChatCompleteConfig,
  TencentChatCompleteResponseTransform,
  TencentChatCompleteStreamChunkTransform,
} from './chatComplete';

const TencentConfig: ProviderConfigs = {
  chatComplete: TencentChatCompleteConfig,
  api: TencentAPIConfig,
  responseTransforms: {
    chatComplete: TencentChatCompleteResponseTransform,
    'stream-chatComplete': TencentChatCompleteStreamChunkTransform,
  },
};

export default TencentConfig;
