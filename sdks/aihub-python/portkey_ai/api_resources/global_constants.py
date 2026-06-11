import httpx


MISSING_API_KEY_ERROR_MESSAGE = """OneLLM API Key Not Found \

Resolution: \

1. Get your OneLLM API key from your OneLLM Console
2. Pass it while instantiating the OneLLM client with api_key param,\
 or set it as an environment variable with export AIHUB_API_KEY=YOUR_API_KEY
"""

MISSING_BASE_URL = """No Base url provided. Please provide a valid base url.
For example: http://localhost:8787/v1
"""

MISSING_CONFIG_MESSAGE = (
    """The 'config' parameter is not set. Please provide a valid Config object."""
)
MISSING_MODE_MESSAGE = (
    """The 'mode' parameter is not set. Please provide a valid mode literal."""
)

INVALID_PORTKEY_MODE = """
Argument of type '{}' cannot be assigned to parameter "mode" of \
    type "ModesLiteral | Modes | None"
"""

LOCALHOST_CONNECTION_ERROR = """Could not instantiate the OneLLM client. \
You can either add a valid `api_key` parameter (from your OneLLM Console)\
or check the `base_url` parameter in the OneLLM client, \
for your OneLLM Gateway's instance's URL.
"""

CUSTOM_HOST_CONNECTION_ERROR = """We could not connect to the OneLLM Gateway. \
Please check the `base_url` parameter in the OneLLM client.
"""

DEFAULT_MAX_RETRIES = 2
VERSION = "0.1.0"
DEFAULT_TIMEOUT = 60
PORTKEY_HEADER_PREFIX = "x-portkey-"
ONELLM_HEADER_PREFIX = "x-onellm-"
AIHUB_HEADER_PREFIX = "x-aihub-"  # @deprecated — use ONELLM_HEADER_PREFIX
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"  # kept for backwards compat
ONELLM_GATEWAY_URL = "http://localhost:8787/v1"
AIHUB_GATEWAY_URL = ONELLM_GATEWAY_URL  # @deprecated
PORTKEY_GATEWAY_URL = ONELLM_GATEWAY_URL
LOCAL_BASE_URL = "http://localhost:8787/v1"
PORTKEY_API_KEY_ENV = "PORTKEY_API_KEY"
ONELLM_API_KEY_ENV = "ONELLM_API_KEY"
AIHUB_API_KEY_ENV = "AIHUB_API_KEY"  # @deprecated — use ONELLM_API_KEY_ENV
PORTKEY_PROXY_ENV = "PORTKEY_PROXY"
OPEN_AI_API_KEY = "OPENAI_API_KEY"
DEFAULT_CONNECTION_LIMITS = httpx.Limits(
    max_connections=1000, max_keepalive_connections=100
)
AUDIO_FILE_DURATION_HEADER = "x-portkey-audio-file-duration"
