"""
LlamaIndex + AI Hub Integration Demo

Demonstrates using the AI Hub LlamaIndexCallbackHandler to trace
LlamaIndex queries, retrievals, and LLM calls through AI Hub.

Prerequisites:
    pip install aihub[llama_index_callback] llama-index llama-index-llms-openai

Usage:
    1. Set AIHUB_API_KEY=aihub_sk_xxx
    2. python examples/llamaindex_demo.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

GATEWAY_URL = os.environ.get("AIHUB_GATEWAY_URL", "http://localhost:8787/v1")
API_KEY = os.environ.get("AIHUB_API_KEY", "")

# ─── 1. Setup LlamaIndex with AI Hub callback ───
from llama_index.core import Settings, VectorStoreIndex, Document
from llama_index.llms.openai import OpenAI
from portkey_ai.llamaindex import LlamaIndexCallbackHandler

# Create the AI Hub callback handler
portkey_handler = LlamaIndexCallbackHandler(
    api_key=API_KEY,
    base_url=GATEWAY_URL,
)

# Configure LlamaIndex LLM to use AI Hub
Settings.llm = OpenAI(
    model="deepseek-chat",
    api_base=GATEWAY_URL,
    api_key=API_KEY,
)
Settings.callback_manager.add_handler(portkey_handler)

# ─── 2. Create a simple document index ───
documents = [
    Document(text="AI Hub 是一个 LLM 统一网关，支持 50+ 模型提供商的一站式接入。"),
    Document(text="AI Hub 提供 Agent 控制平面，包括预算熔断、死循环检测和执行分级管控。"),
    Document(text="AI Hub 兼容 OpenAI API 标准，任何使用 OpenAI SDK 的项目都可以零代码迁移。"),
    Document(text="AI Hub 内置成本追踪系统，可以按 Workspace / Agent / Model 维度下钻成本。"),
]

index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

# ─── 3. Query ───
if __name__ == "__main__":
    print("=" * 50)
    print("Query: AI Hub 有哪些核心功能？")
    print("=" * 50)

    response = query_engine.query("AI Hub 有哪些核心功能？请用中文列出。")
    print(f"\nResponse: {response}")
    print(f"\nSource nodes: {len(response.source_nodes)}")

    print("\n✅ All LlamaIndex operations were auto-traced to AI Hub!")
    print("   Check your AI Hub Dashboard for the recorded events.")
