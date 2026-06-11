import { ProviderConfigs } from '../types';
import XunfeiAPIConfig from './api';
import {
  XunfeiChatCompleteConfig,
  XunfeiChatCompleteResponseTransform,
  XunfeiChatCompleteStreamChunkTransform,
} from './chatComplete';

const XunfeiConfig: ProviderConfigs = {
  chatComplete: XunfeiChatCompleteConfig,
  api: XunfeiAPIConfig,
  responseTransforms: {
    chatComplete: XunfeiChatCompleteResponseTransform,
    'stream-chatComplete': XunfeiChatCompleteStreamChunkTransform,
  },
};

export default XunfeiConfig;
