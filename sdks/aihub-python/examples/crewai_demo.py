"""
CrewAI + AI Hub Integration Demo

Demonstrates using AI Hub's OpenTelemetry instrumentation to
automatically trace all CrewAI operations.

Prerequisites:
    pip install aihub[instrumentation] crewai crewai-tools

Usage:
    1. Set AIHUB_API_KEY=aihub_sk_xxx
    2. python examples/crewai_demo.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

from portkey_ai.api_resources.instrumentation import initialize_instrumentation

# ─── 1. Initialize instrumentation (auto-patches CrewAI) ───
initialize_instrumentation(
    api_key=os.environ.get("AIHUB_API_KEY", ""),
    base_url=os.environ.get("AIHUB_GATEWAY_URL", "http://localhost:8787/v1"),
)

# ─── 2. Use CrewAI normally — all calls auto-traced ───
from crewai import Agent, Task, Crew

researcher = Agent(
    role="AI 研究员",
    goal="研究 AI Hub 的核心功能",
    backstory="你是一位资深 AI 基础设施研究员，善于用简洁的语言总结技术要点。",
    llm="deepseek-chat",  # 通过 AI Hub 路由
    verbose=True,
)

writer = Agent(
    role="技术写手",
    goal="将研究结果写成一篇简短介绍",
    backstory="你是一位技术文档写手，擅长将复杂概念转化为易懂的文字。",
    llm="deepseek-chat",
    verbose=True,
)

research_task = Task(
    description="研究 AI Hub 的主要功能：LLM 统一网关、多模型路由、成本追踪、Agent 管控。总结 3 个核心卖点。",
    expected_output="3 个核心卖点的简短列表，每个一句话。",
    agent=researcher,
)

write_task = Task(
    description="基于研究员的结果，写一篇 100 字以内的 AI Hub 产品介绍。",
    expected_output="一篇简短的产品介绍。",
    agent=writer,
)

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    verbose=True,
)

if __name__ == "__main__":
    result = crew.kickoff()
    print("\n" + "=" * 50)
    print("Final Result:")
    print(result)
    print("=" * 50)
    print("\n✅ All CrewAI operations were auto-traced to AI Hub!")
    print("   Check your AI Hub Dashboard for the recorded events.")
