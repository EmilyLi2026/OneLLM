import { ProviderConfigs } from '../types';
import MiniMaxAPIConfig from './api';
import {
  MiniMaxChatCompleteConfig,
  MiniMaxChatCompleteResponseTransform,
  MiniMaxChatCompleteStreamChunkTransform,
} from './chatComplete';

const MiniMaxConfig: ProviderConfigs = {
  chatComplete: MiniMaxChatCompleteConfig,
  api: MiniMaxAPIConfig,
  responseTransforms: {
    chatComplete: MiniMaxChatCompleteResponseTransform,
    'stream-chatComplete': MiniMaxChatCompleteStreamChunkTransform,
  },
};

export default MiniMaxConfig;
