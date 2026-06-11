import { ProviderConfigs } from '../types';
import BaiduAPIConfig from './api';
import {
  BaiduChatCompleteConfig,
  BaiduChatCompleteResponseTransform,
  BaiduChatCompleteStreamChunkTransform,
} from './chatComplete';

const BaiduConfig: ProviderConfigs = {
  chatComplete: BaiduChatCompleteConfig,
  api: BaiduAPIConfig,
  responseTransforms: {
    chatComplete: BaiduChatCompleteResponseTransform,
    'stream-chatComplete': BaiduChatCompleteStreamChunkTransform,
  },
};

export default BaiduConfig;
