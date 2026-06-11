export const MISSING_API_KEY_ERROR_MESSAGE = `OneLLM API Key Not Found
Resolution: \

1. Get your OneLLM API key from your OneLLM Console \

2. Pass it while instantiating the OneLLM client with apiKey param, or set it as an environment variable with export AIHUB_API_KEY=YOUR_API_KEY
`;

export const MISSING_BASE_URL = `No Base url provided. Please provide a valid base url.
For example: http://localhost:8787/v1
`;

export const MISSING_CONFIG_MESSAGE =
  "The 'config' parameter is not set. Please provide a valid Config object";

export const MISSING_MODE_MESSAGE =
  "The 'mode' parameter is not set. Please provide a valid mode literal.";

export const INVALID_PORTKEY_MODE = `Argument of type '{}' cannot be assigned to parameter "mode" of \
type "ModesLiteral | Modes | None"
`;

export const LOCALHOST_CONNECTION_ERROR = `Could not instantiate the OneLLM client. \
You can either add a valid 'apiKey' parameter (from your OneLLM Console) \
or set the 'baseURL' parameter to your OneLLM Gateway's instance's URL.`;

export const CUSTOM_HOST_CONNECTION_ERROR = `We could not connect to the OneLLM Gateway. \
Please check the 'baseURL' parameter in the OneLLM client.`;

export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_TIMEOUT = 60;
export const PORTKEY_HEADER_PREFIX = 'x-portkey-';
export const ONELLM_HEADER_PREFIX = 'x-onellm-';
export const AIHUB_HEADER_PREFIX = 'x-aihub-';  // @deprecated — use ONELLM_HEADER_PREFIX
export const PORTKEY_BASE_URL = 'https://api.portkey.ai/v1'; // kept for backwards compat
export const ONELLM_GATEWAY_URL = 'http://localhost:8787/v1';
export const AIHUB_GATEWAY_URL = ONELLM_GATEWAY_URL; // @deprecated
export const LOCAL_BASE_URL = 'http://localhost:8787/v1';
export const PORTKEY_GATEWAY_URL = ONELLM_GATEWAY_URL;

export const PORTKEY_API_KEY_ENV = 'PORTKEY_API_KEY';
export const ONELLM_API_KEY_ENV = 'ONELLM_API_KEY';
export const AIHUB_API_KEY_ENV = 'AIHUB_API_KEY'; // @deprecated — use ONELLM_API_KEY_ENV
export const PORTKEY_PROXY_ENV = 'PORTKEY_PROXY';

export const OPEN_AI_API_KEY = 'DUMMY-KEY';

// API routes
export const CHAT_COMPLETE_API = '/chat/completions';
export const TEXT_COMPLETE_API = '/completions';
export const PROMPT_API = '/prompt/complete';
export const FEEDBACK_API = '/feedback';
export const EMBEDDINGS_API = '/embeddings';
export const LOGS_API = '/logs';
export const PROMPTS_API = '/prompts';
export const PROMPT_PARTIALS_API = '/prompts/partials';
export const LABELS_API = '/labels';
export const COLLECTIONS_API = '/collections';
export const INTEGRATIONS_API = '/integrations';
export const PROVIDERS_API = '/providers';
export const GUARDRAILS_API = '/guardrails';
export const AUDIO_FILE_DURATION_HEADER = 'audio-file-duration';
