-- AI Hub Admin API — Database Schema
-- MySQL 8.0+
-- Note: database must already exist (configured in .env DB_NAME)

-- ── Users ──
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_phone (phone)
) ENGINE=InnoDB;

-- ── Workspaces (multi-tenant) ──
CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    owner_id VARCHAR(36) NOT NULL,
    monthly_budget_cents BIGINT DEFAULT 0,
    daily_budget_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Workspace Members ──
CREATE TABLE IF NOT EXISTS workspace_members (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ws_user (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── API Keys
-- Note: provider_credential_id is DEPRECATED — use key_provider_bindings instead ──
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(15) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    scopes JSON DEFAULT NULL,
    provider_credential_id VARCHAR(36) DEFAULT NULL,
    rate_limit_rpm INT DEFAULT 60,
    monthly_budget_cents BIGINT DEFAULT 0,
    daily_budget_cents BIGINT DEFAULT 0,
    revoked TINYINT(1) DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (provider_credential_id) REFERENCES provider_credentials(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Provider Credentials ──
CREATE TABLE IF NOT EXISTS provider_credentials (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ws_provider (workspace_id, provider_name),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Key→Provider Bindings (1:N mapping, replaces api_keys.provider_credential_id) ──
CREATE TABLE IF NOT EXISTS key_provider_bindings (
    id VARCHAR(36) PRIMARY KEY,
    api_key_id VARCHAR(36) NOT NULL,
    provider_credential_id VARCHAR(36) NOT NULL,
    priority_order INT DEFAULT 1,
    weight INT DEFAULT 100,
    enabled TINYINT(1) DEFAULT 1,
    allowed_models JSON DEFAULT NULL,
    daily_budget_cents BIGINT DEFAULT 0,
    monthly_budget_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_key_provider (api_key_id, provider_credential_id),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_credential_id) REFERENCES provider_credentials(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Agents ──
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_model VARCHAR(100) DEFAULT 'gpt-4o',
    api_key_hash VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'active',
    daily_token_limit BIGINT DEFAULT 0,
    monthly_cost_limit_cents BIGINT DEFAULT 0,
    allowed_tools JSON DEFAULT NULL,
    execution_tier INT DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Request Logs ──
CREATE TABLE IF NOT EXISTS request_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id VARCHAR(36),
    user_id VARCHAR(36),
    agent_id VARCHAR(36),
    action_label VARCHAR(255),         -- derived from last user message (renamed from task_id)
    conversation_turn INT DEFAULT NULL, -- conversation round count (renamed from step_number)
    agent_role VARCHAR(500),           -- extracted from system prompt
    session_id VARCHAR(100),           -- session fingerprint for grouping
    request_id VARCHAR(100) UNIQUE,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    binding_id VARCHAR(36),
    api_key_id VARCHAR(36),
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    cost_cents INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    status INT DEFAULT 200,
    error_message TEXT,
    tool_name VARCHAR(255),
    tool_action VARCHAR(20),
    execution_tier INT,
    request_input MEDIUMTEXT,          -- LLM input: system prompt + user messages (JSON)
    request_output MEDIUMTEXT,         -- LLM output: model response content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rl_workspace (workspace_id),
    INDEX idx_rl_agent (agent_id),
    INDEX idx_rl_action (action_label),
    INDEX idx_rl_session (session_id),
    INDEX idx_rl_created (created_at),
    INDEX idx_rl_binding (binding_id)
) ENGINE=InnoDB;

-- ── Audit Logs ──
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id VARCHAR(36),
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSON DEFAULT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_al_workspace (workspace_id),
    INDEX idx_al_created (created_at)
) ENGINE=InnoDB;

-- ── Budget Alerts ──
CREATE TABLE IF NOT EXISTS budget_alerts (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(36),
    threshold_percent INT NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════
-- Model Catalog — 模型目录
-- ═══════════════════════════════════════════════════════

-- ── Model Providers (厂商) ──
CREATE TABLE IF NOT EXISTS model_providers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name_cn VARCHAR(100),
    logo_url VARCHAR(500),
    website VARCHAR(500),
    priority INT DEFAULT 0,
    is_system TINYINT(1) DEFAULT 1,
    workspace_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Model Series (模型系列/能力类型) ──
CREATE TABLE IF NOT EXISTS model_series (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system TINYINT(1) DEFAULT 1,
    workspace_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Model Specs (具体型号) ──
CREATE TABLE IF NOT EXISTS model_specs (
    id VARCHAR(36) PRIMARY KEY,
    provider_id VARCHAR(36) NOT NULL,
    series_id VARCHAR(36),
    name VARCHAR(200) NOT NULL,
    model_id VARCHAR(200) NOT NULL,
    openrouter_model_id VARCHAR(200) DEFAULT NULL COMMENT 'Corresponding OpenRouter model ID for cross-format matching',
    description TEXT,
    context_window INT DEFAULT 0,
    max_output_tokens INT DEFAULT 0,
    pricing_input_cents DECIMAL(10,2) DEFAULT 0,
    pricing_output_cents DECIMAL(10,2) DEFAULT 0,
    capabilities JSON DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'active',
    released_at DATE DEFAULT NULL,
    is_system TINYINT(1) DEFAULT 1,
    workspace_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES model_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES model_series(id) ON DELETE SET NULL,
    INDEX idx_ms_provider (provider_id),
    INDEX idx_ms_series (series_id),
    UNIQUE KEY uk_ms_ws_model (workspace_id, model_id)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════
-- Seed Data: Model Series
-- ═══════════════════════════════════════════════════════

INSERT IGNORE INTO model_series (id, name, slug, description, is_system) VALUES
('series_text_gen',     '文本生成',     'text-generation',    '通用文本生成与对话', 1),
('series_reasoning',    '深度思考',     'reasoning',          '链式推理与复杂问题求解', 1),
('series_visual',       '视觉理解',     'visual',             '图像/视频内容识别与分析', 1),
('series_image_gen',    '图片生成',     'image-generation',   '根据文本描述生成图像', 1),
('series_video_gen',    '视频生成',     'video-generation',   '根据文本/图像生成视频', 1),
('series_audio',        '音频处理',     'audio',              '语音识别、合成与音乐生成', 1),
('series_embedding',    '向量嵌入',     'embedding',          '文本向量化与语义检索', 1),
('series_code',         '代码生成',     'code',               '编程辅助与代码生成', 1),
('series_multimodal',   '多模态',       'multimodal',         '文本+图像+音频多模态交互', 1),
('series_omni',         '全模态',       'omni',               '支持所有模态的输入与输出', 1);

-- ═══════════════════════════════════════════════════════
-- Seed Data: P0 Providers (7家)
-- ═══════════════════════════════════════════════════════

INSERT IGNORE INTO model_providers (id, name, slug, name_cn, website, priority, is_system) VALUES
('prov_deepseek',   'DeepSeek',         'deepseek',     '深度求索',   'https://deepseek.com',         100, 1),
('prov_alibaba',    'Alibaba Cloud',    'alibaba',      '阿里云',     'https://tongyi.aliyun.com',     95, 1),
('prov_zhipu',      'Zhipu AI',         'zhipu',        '智谱AI',     'https://open.bigmodel.cn',      90, 1),
('prov_moonshot',   'Moonshot AI',      'moonshot',     '月之暗面',   'https://moonshot.cn',           85, 1),
('prov_minimax',    'MiniMax',          'minimax',      '稀宇科技',   'https://minimaxi.com',          80, 1),
('prov_baidu',      'Baidu AI Cloud',    'baidu',        '百度智能云', 'https://cloud.baidu.com',       75, 1),
('prov_bytedance',  'ByteDance',        'bytedance',    '字节跳动',   'https://console.volcengine.com',70, 1);

-- ═══════════════════════════════════════════════════════
-- Seed Data: P1 Providers (5家)
-- ═══════════════════════════════════════════════════════

INSERT IGNORE INTO model_providers (id, name, slug, name_cn, website, priority, is_system) VALUES
('prov_xunfei',     'iFLYTEK',          'xunfei',       '科大讯飞',   'https://xinghuo.xfyun.cn',      65, 1),
('prov_lingyi',     '01.AI',            'lingyiwanwu',  '零一万物',   'https://lingyiwanwu.com',       60, 1),
('prov_baichuan',   'Baichuan AI',      'baichuan',     '百川智能',   'https://baichuan-ai.com',       55, 1),
('prov_tencent',    'Tencent Cloud',    'tencent',      '腾讯混元',   'https://cloud.tencent.com',     50, 1),
('prov_stepfun',    'StepFun',          'stepfun',      '阶跃星辰',   'https://stepfun.com',           45, 1);

-- ═══════════════════════════════════════════════════════
-- Seed Data: P0 Model Specs (DeepSeek, 阿里, 智谱, 月之暗面, MiniMax, 百度, 字节)
-- ═══════════════════════════════════════════════════════

-- DeepSeek
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_ds_v4pro',      'prov_deepseek', 'series_reasoning',    'DeepSeek V4 Pro',        'deepseek-reasoner',      '最新旗舰推理模型，128K上下文，极致推理能力',               128000,  65536, 28, 112, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ds_v4flash',    'prov_deepseek', 'series_reasoning',    'DeepSeek V4 Flash',      'deepseek-reasoner-lite', '轻量推理模型，快速响应，成本更低',                         128000,  32768, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ds_v3_2',       'prov_deepseek', 'series_text_gen',     'DeepSeek V3.2',           'deepseek-chat',          '通用文本对话模型，128K上下文，高性价比',                   128000,  16384,  7,  28, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ds_chat_lite',  'prov_deepseek', 'series_text_gen',     'DeepSeek Chat Lite',      'deepseek-chat-lite',     '轻量对话模型，极低成本',                                    32768,   8192,  1,   4, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ds_vl2',        'prov_deepseek', 'series_visual',       'DeepSeek VL2',            'deepseek-vl2',           '视觉理解模型，支持图像分析',                                16384,   4096, 10,  30, '{"function_calling":false,"vision":true}', 'beta', 1),
('spec_ds_coder',      'prov_deepseek', 'series_code',         'DeepSeek Coder V4',       'deepseek-coder',         '代码生成专用模型，支持多语言编程',                          128000,  32768,  7,  28, '{"function_calling":true,"vision":false}', 'active', 1);

-- 阿里云 / 通义千问
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_qwen3_max',     'prov_alibaba', 'series_text_gen',     'Qwen3 Max',               'qwen3-max',             '阿里最强文本模型，卓越的逻辑推理与长文理解',              128000,  16384, 28, 112, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_qwen3_plus',    'prov_alibaba', 'series_text_gen',     'Qwen3 Plus',              'qwen3-plus',            '平衡性能与成本的通用模型',                                  128000,  16384, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_qwen3_turbo',   'prov_alibaba', 'series_text_gen',     'Qwen3 Turbo',             'qwen3-turbo',           '轻量快速响应模型',                                          32768,   8192,  5,  20, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_qwenvl_max',    'prov_alibaba', 'series_visual',       'Qwen VL Max',             'qwen-vl-max',           '旗舰视觉理解模型，支持图文混合输入',                        32768,   8192, 28, 112, '{"function_calling":false,"vision":true}', 'active', 1),
('spec_qwenvl_plus',   'prov_alibaba', 'series_visual',       'Qwen VL Plus',            'qwen-vl-plus',          '高性价比视觉模型',                                          16384,   4096, 14,  56, '{"function_calling":false,"vision":true}', 'active', 1),
('spec_wan2_1',        'prov_alibaba', 'series_video_gen',    'Wan 2.1',                 'wan2.1',                '文生视频/图生视频模型，支持1080P',                           NULL,     NULL,  0,   0, '{"vision":false}', 'active', 1),
('spec_qwen_audio',    'prov_alibaba', 'series_audio',        'Qwen Audio',              'qwen-audio',            '音频理解与语音交互模型',                                    30000,   4096, 21,  84, '{"function_calling":false}', 'active', 1),
('spec_qwen_embed',    'prov_alibaba', 'series_embedding',    'Qwen Embedding V4',       'qwen-embedding-v4',     '文本向量嵌入模型，支持多语言语义检索',                      8192,    NULL,  0,   0, '{"function_calling":false}', 'active', 1);

-- 智谱AI / GLM
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_glm4_6',        'prov_zhipu', 'series_text_gen',     'GLM-4.6',                 'glm-4.6',               '智谱最新旗舰模型，128K上下文，强大的理解与生成能力',        128000,  16384, 28, 112, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_glm4_flash',    'prov_zhipu', 'series_text_gen',     'GLM-4 Flash',             'glm-4-flash',           '快速响应模型，免费额度使用',                                128000,   4096,  0,   0, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_glm4v',         'prov_zhipu', 'series_visual',       'GLM-4V',                  'glm-4v',                '视觉理解模型，支持图文混合推理',                            16384,   4096, 14,  56, '{"function_calling":true,"vision":true}', 'active', 1),
('spec_cogview4',      'prov_zhipu', 'series_image_gen',    'CogView-4',               'cogview-4',             '最新文生图模型，支持高分辨率输出',                           NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1),
('spec_glm4_code',     'prov_zhipu', 'series_code',         'GLM-4 Code',              'glm-4-code',            '代码生成专用模型',                                          128000,   8192, 14,  56, '{"function_calling":true,"vision":false}', 'beta', 1);

-- 月之暗面 / Kimi
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_moonshot_v2',   'prov_moonshot', 'series_text_gen',   'Moonshot V2 (128K)',      'moonshot-v2-128k',     'Kimi 旗舰模型，128K超长上下文理解',                         128000,  16384, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_kimi_think',    'prov_moonshot', 'series_reasoning',  'Kimi Thinking',           'kimi-thinking',         '深度推理模型，逐步思考复杂问题',                            64000,   8192, 28, 112, '{"function_calling":false,"vision":false}', 'beta', 1),
('spec_moonshot_vl',   'prov_moonshot', 'series_visual',     'Moonshot VL',             'moonshot-vl',           '视觉理解模型',                                              16384,   4096,  0,   0, '{"function_calling":false,"vision":true}', 'coming_soon', 1);

-- MiniMax
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_abab7_5',       'prov_minimax', 'series_text_gen',     'ABAB 7.5',               'abab7.5',               'MiniMax 最新旗舰文本模型，1M上下文',                        1000000, 16384, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_abab7',         'prov_minimax', 'series_text_gen',     'ABAB 7',                 'abab7',                 '通用文本对话模型',                                          128000,  8192,  7,  28, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_minimax_tts',   'prov_minimax', 'series_audio',        'MiniMax Speech-02',      'speech-02',             '高表现力语音合成，支持多种音色与情感',                       NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1),
('spec_minimax_video', 'prov_minimax', 'series_video_gen',    'MiniMax Video-01',       'video-01',              '文生视频模型，支持高清画质',                                 NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1),
('spec_minimax_music', 'prov_minimax', 'series_audio',        'MiniMax Music-01',       'music-01',              'AI音乐生成模型，支持多种风格',                               NULL,     NULL,  0,   0, '{"function_calling":false}', 'beta', 1);

-- 百度智能云 / ERNIE
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_ernie4_5',      'prov_baidu', 'series_text_gen',     'ERNIE 4.5',               'ernie-4.5',             '百度最新旗舰大模型，知识增强型',                            128000,  16384, 28, 112, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ernie4_5t',     'prov_baidu', 'series_text_gen',     'ERNIE 4.5 Turbo',         'ernie-4.5-turbo',       '快速响应版，性价比更高',                                    64000,   8192, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_ernie_vilg3',   'prov_baidu', 'series_image_gen',    'ERNIE-ViLG V3',           'ernie-vilg-v3',         '文生图模型，支持国风/写实/二次元多种风格',                  NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1),
('spec_ernie_speed',   'prov_baidu', 'series_text_gen',     'ERNIE Speed',             'ernie-speed',           '极速推理模型，适合高并发场景',                              32768,   4096,  0,   0, '{"function_calling":true,"vision":false}', 'active', 1);

-- 字节跳动 / 豆包
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_doubao_pro',    'prov_bytedance', 'series_text_gen',  'Doubao Pro 256K',         'doubao-pro-256k',       '豆包旗舰模型，256K超长上下文',                              256000,  16384, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_doubao_vision', 'prov_bytedance', 'series_visual',    'Doubao Vision',           'doubao-vision',         '豆包视觉模型，支持多图理解',                                16384,   8192, 14,  56, '{"function_calling":false,"vision":true}', 'active', 1),
('spec_doubao_lite',   'prov_bytedance', 'series_text_gen',  'Doubao Lite',             'doubao-lite',           '豆包轻量模型，极低成本',                                    32768,   4096,  1,   4, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_doubao_video',  'prov_bytedance', 'series_video_gen', 'Doubao VideoGen',         'doubao-videogen',       '豆包视频生成模型',                                           NULL,     NULL,  0,   0, '{"function_calling":false}', 'beta', 1);

-- ═══════════════════════════════════════════════════════
-- Seed Data: P1 Model Specs
-- ═══════════════════════════════════════════════════════

-- 科大讯飞 / 星火
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_spark4',        'prov_xunfei', 'series_text_gen',     'Spark V4.0',              'spark-v4.0',            '讯飞星火最新大模型，多模态交互能力',                        8192,    4096, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_spark3_5',      'prov_xunfei', 'series_text_gen',     'Spark V3.5',              'spark-v3.5',            '星火通用模型，高性价比',                                    8192,    4096,  5,  20, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_spark_vl',      'prov_xunfei', 'series_visual',       'Spark VL',                'spark-vl',              '星火视觉理解模型',                                          4096,    2048,  0,   0, '{"function_calling":false,"vision":true}', 'beta', 1);

-- 零一万物 / Yi
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_yi_large',      'prov_lingyi', 'series_text_gen',     'Yi Large',                'yi-large',              '零一万物旗舰模型，200K上下文',                              200000,  16384, 21,  84, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_yi_medium',     'prov_lingyi', 'series_text_gen',     'Yi Medium',               'yi-medium',             '中等规模通用模型',                                          32768,   8192, 10,  40, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_yi_vision',     'prov_lingyi', 'series_visual',       'Yi Vision',               'yi-vision',             '视觉语言模型',                                              16384,   4096, 21,  84, '{"function_calling":false,"vision":true}', 'active', 1);

-- 百川智能
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_baichuan4',     'prov_baichuan', 'series_text_gen',   'Baichuan 4',              'baichuan4',             '百川最新旗舰模型',                                          32768,   8192, 14,  56, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_baichuan3_turbo','prov_baichuan','series_text_gen',   'Baichuan 3 Turbo',        'baichuan3-turbo',       '百川快速模型',                                               8192,   4096,  5,  20, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_baichuan_med',  'prov_baichuan', 'series_text_gen',   'Baichuan Medical',        'baichuan-medical',      '百川医疗领域大模型',                                        16384,   4096, 0,    0, '{"function_calling":false}', 'active', 1);

-- 腾讯混元
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_hunyuan_pro',   'prov_tencent', 'series_multimodal',  'Hunyuan Pro',             'hunyuan-pro',           '腾讯混元旗舰多模态模型',                                    32000,   8192, 14,  56, '{"function_calling":true,"vision":true}', 'active', 1),
('spec_hunyuan_turbo', 'prov_tencent', 'series_text_gen',    'Hunyuan Turbo',           'hunyuan-turbo',         '混元快速模型',                                              32000,   4096,  5,  20, '{"function_calling":true,"vision":false}', 'active', 1),
('spec_hunyuan_video', 'prov_tencent', 'series_video_gen',   'Hunyuan Video',           'hunyuan-video',         '混元视频生成模型',                                           NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1),
('spec_hunyuan_img',   'prov_tencent', 'series_image_gen',   'Hunyuan ImageGen',        'hunyuan-image',         '混元图片生成模型',                                           NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1);

-- 阶跃星辰
INSERT IGNORE INTO model_specs (id, provider_id, series_id, name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, is_system) VALUES
('spec_step2',         'prov_stepfun', 'series_multimodal',  'Step-2',                  'step-2',                '阶跃星辰旗舰多模态模型，万亿参数MoE',                       128000,  16384, 14,  56, '{"function_calling":true,"vision":true}', 'active', 1),
('spec_step1v',        'prov_stepfun', 'series_visual',      'Step-1V',                 'step-1v',               '视觉理解模型',                                              32768,   8192, 10,  40, '{"function_calling":false,"vision":true}', 'active', 1),
('spec_step_video',    'prov_stepfun', 'series_video_gen',   'Step-Video',              'step-video',            '视频生成模型',                                               NULL,     NULL,  0,   0, '{"function_calling":false}', 'active', 1);

-- ── Contact Inquiries (销售/技术支持咨询表单) ──
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '联系人姓名',
    phone VARCHAR(30) NOT NULL COMMENT '联系方式-手机号',
    company VARCHAR(255) DEFAULT '' COMMENT '公司名称',
    team_size VARCHAR(50) DEFAULT '' COMMENT '团队规模',
    interests JSON DEFAULT NULL COMMENT '感兴趣的方向',
    message TEXT COMMENT '补充说明',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/contacted/closed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Verification Codes (短信验证码) ──
CREATE TABLE IF NOT EXISTS verification_codes (
    id VARCHAR(36) PRIMARY KEY,
    phone VARCHAR(30) NOT NULL COMMENT '手机号',
    code VARCHAR(10) NOT NULL COMMENT '6位验证码',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    used TINYINT(1) DEFAULT 0 COMMENT '是否已使用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vc_phone (phone),
    INDEX idx_vc_expires (expires_at)
) ENGINE=InnoDB;

-- ── Invitations (工作区邀请码) ──
CREATE TABLE IF NOT EXISTS invitations (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_by VARCHAR(36) NOT NULL,
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    max_uses INT DEFAULT 1 COMMENT '最大使用次数',
    use_count INT DEFAULT 0 COMMENT '已使用次数',
    accepted_by VARCHAR(36) DEFAULT NULL COMMENT '接受者 user_id',
    accepted_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active/expired/revoked/accepted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (accepted_by) REFERENCES users(id)
) ENGINE=InnoDB;
