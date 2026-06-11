import { ProviderConfigs } from '../types';
import BaichuanAPIConfig from './api';
import {
  BaichuanChatCompleteConfig,
  BaichuanChatCompleteResponseTransform,
  BaichuanChatCompleteStreamChunkTransform,
} from './chatComplete';

const BaichuanConfig: ProviderConfigs = {
  chatComplete: BaichuanChatCompleteConfig,
  api: BaichuanAPIConfig,
  responseTransforms: {
    chatComplete: BaichuanChatCompleteResponseTransform,
    'stream-chatComplete': BaichuanChatCompleteStreamChunkTransform,
  },
};

export default BaichuanConfig;
