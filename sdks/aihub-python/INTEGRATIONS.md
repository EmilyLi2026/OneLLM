# AI Hub Python SDK — 框架集成指南

## 概述

AI Hub Python SDK 提供对以下主流 AI 框架的深度集成：

| 框架 | 集成方式 | 安装方式 |
|------|---------|----------|
| **OpenAI SDK** | OpenTelemetry 自动插桩 | `pip install aihub[instrumentation]` |
| **LangChain** | Callback Handler + LLM/Chat 包装器 | `pip install aihub[langchain_callback]` |
| **LlamaIndex** | Callback Handler | `pip install aihub[llama_index_callback]` |
| **CrewAI** | OpenTelemetry 自动插桩 | `pip install aihub[instrumentation] crewai` |
| **LangGraph** | OpenTelemetry 自动插桩 | `pip install aihub[instrumentation] langgraph` |
| **LiteLLM** | OpenTelemetry 自动插桩 | `pip install aihub[instrumentation] litellm` |
| **Google ADK** | Full adapter (`PortkeyAdk`) | `pip install aihub[adk]` |
| **Strands** | Full adapter (`PortkeyStrands`) | `pip install aihub[strands]` |

所有集成均通过 AI Hub 网关统一路由，自动记录 Token 消耗、延迟和费用。

---

## 快速开始

```bash
# 安装 SDK（含所有可选集成）
pip install aihub[langchain_callback,llama_index_callback,instrumentation,adk,strands]

# 设置环境变量
export AIHUB_API_KEY=aihub_sk_xxx
export AIHUB_GATEWAY_URL=http://localhost:8787/v1  # 或你的网关地址
```

---

## LangChain 集成

### 方式 A：Callback Handler（推荐）

```python
from langchain_openai import ChatOpenAI
from portkey_ai.langchain import LangchainCallbackHandler

handler = LangchainCallbackHandler(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
    metadata={"project": "my-app"},
)

llm = ChatOpenAI(
    model="deepseek-chat",
    base_url="http://localhost:8787/v1",
    api_key="your-aihub-key",
    callbacks=[handler],
)

response = llm.invoke("你好")
# 调用自动记录到 AI Hub Dashboard
```

**追踪覆盖：** LLM 调用、Chain 执行、Tool 调用、Retriever 查询、Agent 操作。

### 方式 B：ChatPortkey 包装器

```python
from portkey_ai.llms.langchain.chat import ChatPortkey

llm = ChatPortkey(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
    model="deepseek-chat",
)

response = llm.invoke("你好")
# 无需 callback，自动上报
```

### 运行示例

```bash
python examples/langchain_demo.py
```

---

## CrewAI 集成

通过 OpenTelemetry 自动插桩，零代码侵入：

```python
from portkey_ai.api_resources.instrumentation import initialize_instrumentation

# 一行初始化，自动追踪所有 CrewAI 操作
initialize_instrumentation(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
)

# CrewAI 代码无需任何修改
from crewai import Agent, Task, Crew
# ... 正常使用 CrewAI
```

**追踪覆盖：** `Crew.kickoff`、`Agent.execute_task`、`Task.execute_sync`、`RAGStorage.save/search/reset`。

### 运行示例

```bash
pip install aihub[instrumentation] crewai crewai-tools
python examples/crewai_demo.py
```

---

## LlamaIndex 集成

```python
from llama_index.core import Settings
from llama_index.llms.openai import OpenAI
from portkey_ai.llamaindex import LlamaIndexCallbackHandler

handler = LlamaIndexCallbackHandler(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
)

Settings.llm = OpenAI(
    model="deepseek-chat",
    api_base="http://localhost:8787/v1",
    api_key="your-aihub-key",
)
Settings.callback_manager.add_handler(handler)

# 正常使用 LlamaIndex — 所有操作自动追踪
```

**追踪覆盖：** LLM 生成、Embedding、Retrieval、Node Parsing、Query 等全部事件类型。

### 运行示例

```bash
pip install aihub[llama_index_callback] llama-index llama-index-llms-openai
python examples/llamaindex_demo.py
```

---

## Google ADK 集成

```python
from google.adk.agents import LlmAgent
from portkey_ai.integrations.adk import PortkeyAdk

llm = PortkeyAdk(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
    model="deepseek-chat",
)

agent = LlmAgent(
    name="assistant",
    model=llm,
    instruction="你是一个有帮助的助手。",
)
```

**支持特性：** Streaming、Tool Calling、Thinking/Reasoning、JSON Schema 输出。

### 运行示例

```bash
pip install aihub[adk] google-adk google-genai
python examples/hello_world_portkey_adk.py
python examples/adk_streaming_thinking_usage.py
```

---

## Strands 集成

```python
from portkey_ai.integrations.strands import PortkeyStrands

model = PortkeyStrands(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
    model_id="deepseek-chat",
)

# 使用 model.stream() 进行流式对话
async for event in model.stream(messages=[...]):
    print(event.delta, end="")
```

### 运行示例

```bash
pip install aihub[strands] strands-agents
python examples/hello_world_portkey_strands.py
```

---

## OpenTelemetry 插桩（通用）

一次初始化，自动检测并插桩已安装的包：

```python
from portkey_ai.api_resources.instrumentation import initialize_instrumentation

initialize_instrumentation(
    api_key="your-aihub-key",
    base_url="http://localhost:8787/v1",
)

# SDK 自动检测并插桩：crewai, litellm, langgraph
# 所有 LLM 调用自动上报到 AI Hub
```

**自动检测的包：** `crewai`、`litellm`、`langgraph`（检测到即自动插桩）。

---

## Dify / Coze / Vercel AI SDK

这些平台/框架的集成方式为 **OpenAI 兼容配置**，即：

1. 在平台中将模型供应商/自定义端点配置为 OpenAI-API-compatible
2. 填写 AI Hub 网关地址和 API Key
3. 即可使用 AI Hub 路由的所有模型

**详细配置指南参见** AI Hub 管理控制台文档站：`/docs#dify`、`/docs#coze`、`/docs#vercel-ai-sdk`。

---

## 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `api_key` | AI Hub API Key（`aihub_sk_` 或 `aihub_ag_` 前缀） | 读取环境变量 `AIHUB_API_KEY` |
| `base_url` | AI Hub 网关地址 | `http://localhost:8787/v1` |
| `metadata` | 自定义元数据，附加到所有追踪事件 | `None` |

### 环境变量

```bash
# AI Hub API Key（SDK 自动读取）
export AIHUB_API_KEY=aihub_sk_xxx

# 网关地址（可选，默认 localhost:8787）
export AIHUB_GATEWAY_URL=https://your-gateway.aihub.com/v1

# 兼容旧版 Portkey 环境变量
export PORTKEY_API_KEY=aihub_sk_xxx      # 向后兼容
export PORTKEY_PROXY=http://localhost:8787/v1  # 向后兼容
```

---

## 更多资源

- [AI Hub 主仓库](https://github.com/ai-hub/gateway)
- [Node.js SDK 集成指南](../aihub-node/README.md)
- [AI Hub 管理控制台](http://localhost:3001)
