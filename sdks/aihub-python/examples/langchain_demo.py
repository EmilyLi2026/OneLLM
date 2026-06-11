"""
LangChain + AI Hub Integration Demo

Demonstrates using the AI Hub LangchainCallbackHandler to trace
LangChain LLM calls, chains, and agent operations.

Supports TWO modes:
    Mode A: Callback Handler (auto-tracing, zero code change)
    Mode B: PortkeyLLM / ChatPortkey wrapper (direct replacement)

Prerequisites:
    pip install aihub[langchain_callback] langchain langchain-openai

Usage:
    1. Set AIHUB_API_KEY=aihub_sk_xxx
    2. python examples/langchain_demo.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

GATEWAY_URL = os.environ.get("AIHUB_GATEWAY_URL", "http://localhost:8787/v1")
API_KEY = os.environ.get("AIHUB_API_KEY", "")

# ═══════════════════════════════════════════════════════════════
# Mode A: Callback Handler (auto-tracing)
# ═══════════════════════════════════════════════════════════════
def demo_callback_mode():
    print("=" * 50)
    print("Mode A: Callback Handler")
    print("=" * 50)

    from langchain_openai import ChatOpenAI
    from portkey_ai.langchain import LangchainCallbackHandler

    # Create the AI Hub callback
    handler = LangchainCallbackHandler(
        api_key=API_KEY,
        base_url=GATEWAY_URL,
        metadata={"demo": "langchain_callback", "mode": "A"},
    )

    # Use standard LangChain LLM with callback
    llm = ChatOpenAI(
        model="deepseek-chat",
        base_url=GATEWAY_URL,
        api_key=API_KEY,
        temperature=0.7,
        callbacks=[handler],
    )

    # 1. Single invoke
    print("\n1. Single invoke:")
    response = llm.invoke("用一句话介绍 AI Hub。")
    print(f"   {response.content}")

    # 2. Batch
    print("\n2. Batch invoke:")
    responses = llm.batch([
        "什么是 LLM 网关？",
        "Agent 控制平面的核心功能是什么？",
    ])
    for i, r in enumerate(responses, 1):
        print(f"   [{i}] {r.content[:80]}...")

    # 3. Streaming
    print("\n3. Streaming:")
    for chunk in llm.stream("写一个三行诗。"):
        print(chunk.content, end="", flush=True)
    print()

    print("\n✅ Mode A complete!")

# ═══════════════════════════════════════════════════════════════
# Mode B: ChatPortkey Wrapper (direct replacement)
# ═══════════════════════════════════════════════════════════════
def demo_wrapper_mode():
    print("\n" + "=" * 50)
    print("Mode B: ChatPortkey Wrapper")
    print("=" * 50)

    from portkey_ai.llms.langchain.chat import ChatPortkey

    # ChatPortkey directly wraps the LangChain ChatModel
    # No callback needed — auto-traces by design
    llm = ChatPortkey(
        api_key=API_KEY,
        base_url=GATEWAY_URL,
        model="deepseek-chat",
        temperature=0.7,
    )

    response = llm.invoke("用一句话介绍 AI Hub。")
    print(f"\nResponse: {response.content}")
    print(f"Model: {response.response_metadata.get('model', 'unknown')}")

    print("\n✅ Mode B complete!")
    print("\n" + "=" * 50)
    print("Both modes completed successfully!")
    print("Check your AI Hub Dashboard for the recorded events.")
    print("=" * 50)


if __name__ == "__main__":
    demo_callback_mode()
    demo_wrapper_mode()
