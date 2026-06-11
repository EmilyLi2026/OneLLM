import BytezConfig from './bytez';
import AI21Config from './ai21';
import AnthropicConfig from './anthropic';
import AnyscaleConfig from './anyscale';
import AzureOpenAIConfig from './azure-openai';
import BedrockConfig from './bedrock';
import CohereConfig from './cohere';
import DeepInfraConfig from './deepinfra';
import NCompassConfig from './ncompass';
import GoogleConfig from './google';
import VertexConfig from './google-vertex-ai';
import MistralAIConfig from './mistral-ai';
import NomicConfig from './nomic';
import OpenAIConfig from './openai';
import PalmAIConfig from './palm';
import PerplexityAIConfig from './perplexity-ai';
import TogetherAIConfig from './together-ai';
import StabilityAIConfig from './stability-ai';
import OllamaAPIConfig from './ollama';
import { ProviderConfigs } from './types';
import GroqConfig from './groq';
import SegmindConfig from './segmind';
import JinaConfig from './jina';
import FireworksAIConfig from './fireworks-ai';
import WorkersAiConfig from './workers-ai';
import RekaAIConfig from './reka-ai';
import MoonshotConfig from './moonshot';
import OpenrouterConfig from './openrouter';
import LingYiConfig from './lingyi';
import ZhipuConfig from './zhipu';
import NovitaAIConfig from './novita-ai';
import MonsterAPIConfig from './monsterapi';
import DeepSeekAPIConfig from './deepseek';
import PredibaseConfig from './predibase';
import TritonConfig from './triton/';
import VoyageConfig from './voyage';
import {
  AzureAIInferenceAPIConfig,
  GithubModelAPiConfig,
} from './azure-ai-inference';
import DeepbricksConfig from './deepbricks';
import SiliconFlowConfig from './siliconflow';
import HuggingfaceConfig from './huggingface';
import { cerebrasProviderAPIConfig } from './cerebras';
import { InferenceNetProviderConfigs } from './inference-net';
import SambaNovaConfig from './sambanova';
import LemonfoxAIConfig from './lemonfox-ai';
import { UpstageConfig } from './upstage';
import { LAMBDA } from '../globals';
import { LambdaProviderConfig } from './lambda';
import { DashScopeConfig } from './dashscope';
import XAIConfig from './x-ai';
import QdrantConfig from './qdrant';
import SagemakerConfig from './sagemaker';
import NebiusConfig from './nebius';
import RecraftAIConfig from './recraft-ai';
import MilvusConfig from './milvus';
import ReplicateConfig from './replicate';
import LeptonConfig from './lepton';
import KlusterAIConfig from './kluster-ai';
import NscaleConfig from './nscale';
import HyperbolicConfig from './hyperbolic';
import { FeatherlessAIConfig } from './featherless-ai';
import KrutrimConfig from './krutrim';
import AI302Config from './302ai';
import MeshyConfig from './meshy';
import Tripo3DConfig from './tripo3d';
import { NextBitConfig } from './nextbit';
import CometAPIConfig from './cometapi';
import ZAIConfig from './z-ai';
import MatterAIConfig from './matterai';
import ModalConfig from './modal';
import OracleConfig from './oracle';
import IOIntelligenceConfig from './iointelligence';
import AIBadgrConfig from './aibadgr';
import OVHcloudConfig from './ovhcloud';
import MiniMaxConfig from './minimax';
import ByteDanceConfig from './bytedance';
import BaichuanConfig from './baichuan';
import BaiduConfig from './baidu';
import XunfeiConfig from './xunfei';
import TencentConfig from './tencent';

/**
 * AI Hub Provider Registry
 *
 * Pruned from 78 to 33 core providers focused on Chinese market needs.
 * Kept: international leaders + Chinese providers + cloud platform specialized.
 * Removed imports still present above for build compatibility (tree-shaken at runtime).
 */
const Providers: { [key: string]: ProviderConfigs } = {
  // ── International Leaders (22) ──
  openai: OpenAIConfig,
  anthropic: AnthropicConfig,
  google: GoogleConfig,
  'azure-openai': AzureOpenAIConfig,
  bedrock: BedrockConfig,
  groq: GroqConfig,
  'mistral-ai': MistralAIConfig,
  cohere: CohereConfig,
  'together-ai': TogetherAIConfig,
  'perplexity-ai': PerplexityAIConfig,
  deepinfra: DeepInfraConfig,
  ollama: OllamaAPIConfig,
  huggingface: HuggingfaceConfig,
  'stability-ai': StabilityAIConfig,
  'fireworks-ai': FireworksAIConfig,
  cerebras: cerebrasProviderAPIConfig,
  'x-ai': XAIConfig,
  openrouter: OpenrouterConfig,
  sambanova: SambaNovaConfig,
  replicate: ReplicateConfig,
  nebius: NebiusConfig,
  hyperbolic: HyperbolicConfig,

  // ── Chinese Providers (12) ──
  deepseek: DeepSeekAPIConfig,
  zhipu: ZhipuConfig,
  moonshot: MoonshotConfig,
  siliconflow: SiliconFlowConfig,
  lingyi: LingYiConfig,
  dashscope: DashScopeConfig,
  alibaba: DashScopeConfig,           // alias — DB stores 'alibaba' as provider slug
  minimax: MiniMaxConfig,
  bytedance: ByteDanceConfig,
  baichuan: BaichuanConfig,
  baidu: BaiduConfig,
  xunfei: XunfeiConfig,
  tencent: TencentConfig,

  // ── Embedding Specialists (2) ──
  voyage: VoyageConfig,
  jina: JinaConfig,

  // ── Cloud Platform Specialized (3) ──
  'vertex-ai': VertexConfig,
  sagemaker: SagemakerConfig,
  'azure-ai': AzureAIInferenceAPIConfig,
};

export default Providers;
