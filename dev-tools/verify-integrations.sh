#!/usr/bin/env bash
# ============================================================
# OneLLM — 生态集成能力自检脚本
# 验证网关/SDK/前端对生态集成描述的能力覆盖情况
# ============================================================
set -e

GATEWAY="http://localhost:9799"
ADMIN_API="http://localhost:3100"
CONSOLE="http://localhost:3001"
FRONTEND="http://localhost:5173"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
info()  { echo -e "\033[36m  → $1\033[0m"; }
h2()    { echo ""; echo -e "\033[1m$1\033[0m"; echo "──────────────────────────────────────"; }

# ── 1. Gateway 核心能力 ──
h2 "1. Gateway — OpenAI 兼容性"

# 1.1 根端点
if curl -sf "$GATEWAY/" > /dev/null; then green "GET /        → Gateway 存活"; else red "GET /        → 无响应"; fi

# 1.2 模型列表
MODELS=$(curl -sf "$GATEWAY/v1/models" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "0")
info "GET /v1/models → $MODELS 个模型（需配置 Provider 凭证后可用）"

# 1.3 Chat Completions（无凭证时的错误响应应为 JSON）
CHAT_RESP=$(curl -s -w "\n%{http_code}" "$GATEWAY/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"hi"}]}' 2>/dev/null)
CHAT_CODE=$(echo "$CHAT_RESP" | tail -1)
if [ "$CHAT_CODE" != "000" ]; then green "POST /v1/chat/completions → HTTP $CHAT_CODE（端点可达）"; else red "POST /v1/chat/completions → 无响应"; fi

# 1.4 Embeddings
EMB_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","input":"hello"}' 2>/dev/null)
if [ "$EMB_CODE" != "000" ]; then green "POST /v1/embeddings → HTTP $EMB_CODE（端点可达）"; else red "POST /v1/embeddings → 无响应"; fi

# 1.5 Images
IMG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/v1/images/generations" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","prompt":"test"}' 2>/dev/null)
info "POST /v1/images/generations → HTTP $IMG_CODE"

# 1.6 Audio (speech)
AUDIO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","input":"hello","voice":"alloy"}' 2>/dev/null)
info "POST /v1/audio/speech → HTTP $AUDIO_CODE"

# ── 2. Admin API ──
h2 "2. Admin API — 管理能力"

if curl -sf "$ADMIN_API/api/health" > /dev/null; then green "GET /api/health → OK"; else red "GET /api/health → 无响应"; fi

# 公开模型列表
PUBLIC_MODELS=$(curl -sf "$ADMIN_API/api/v1/models/public" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "?")
info "GET /api/v1/models/public → $PUBLIC_MODELS 个模型"

# ── 3. Python SDK ──
h2 "3. Python SDK — 导入与配置"

PY_RESULT=$(python3 -c "
from portkey_ai import Portkey, PORTKEY_GATEWAY_URL
from portkey_ai.langchain import LangchainCallbackHandler
from portkey_ai.llamaindex import LlamaIndexCallbackHandler
from portkey_ai.integrations.adk import PortkeyAdk
from portkey_ai.integrations.strands import PortkeyStrands
from portkey_ai.api_resources.instrumentation import initialize_instrumentation
from portkey_ai.llms.langchain.chat import ChatPortkey
print('ALL_IMPORTS_OK')
print('GATEWAY_URL:', PORTKEY_GATEWAY_URL)
" 2>&1)
if echo "$PY_RESULT" | grep -q "ALL_IMPORTS_OK"; then
  green "所有 Python SDK 子模块导入成功"
  echo "$PY_RESULT" | while read line; do info "$line"; done
else
  red "Python SDK 导入失败："
  echo "$PY_RESULT"
fi

# ── 4. Node.js SDK ──
h2 "4. Node.js SDK — TypeScript 编译"

cd "$(dirname "$0")/../sdks/aihub-node"
NODE_RESULT=$(npx -p typescript tsc --noEmit --skipLibCheck 2>&1 || true)
if echo "$NODE_RESULT" | grep -q "error TS"; then
  red "TypeScript 编译有错误"
  echo "$NODE_RESULT"
else
  green "TypeScript 编译通过 (langchain/vercel 模块无语法错误)"
fi
cd - > /dev/null

# ── 5. Frontend 页面 ──
h2 "5. Frontend — 页面可访问"

for page in integrations docs; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/$page" 2>/dev/null)
  if [ "$CODE" = "200" ]; then green "/$page → HTTP 200"; else red "/$page → HTTP $CODE"; fi
done

# ── 6. 框架集成（代码存在性检查） ──
h2 "6. 框架集成 — 代码文件检查"

SDK_DIR="$(dirname "$0")/../sdks"

check_file() { if [ -f "$1" ]; then green "$2"; else red "$2 — 文件缺失"; fi; }

# Python SDK
PY_DIR="$SDK_DIR/aihub-python/portkey_ai"
check_file "$PY_DIR/langchain/portkey_langchain_callback_handler.py" "LangChain Callback (Python)"
check_file "$PY_DIR/llamaindex/portkey_llama_callback_handler.py" "LlamaIndex Callback (Python)"
check_file "$PY_DIR/api_resources/instrumentation/crewai/instrumentation.py" "CrewAI Instrumentation (Python)"
check_file "$PY_DIR/api_resources/instrumentation/langgraph/instrumentation.py" "LangGraph Instrumentation (Python)"
check_file "$PY_DIR/api_resources/instrumentation/litellm/instrumentation.py" "LiteLLM Instrumentation (Python)"
check_file "$PY_DIR/api_resources/instrumentation/openai/instrumentation.py" "OpenAI Instrumentation (Python)"
check_file "$PY_DIR/integrations/adk.py" "Google ADK Adapter (Python)"
check_file "$PY_DIR/integrations/strands.py" "Strands Adapter (Python)"

# Node.js SDK
NODE_DIR="$SDK_DIR/aihub-node/src"
check_file "$NODE_DIR/langchain/callback.ts" "LangChain Callback (Node.js)"
check_file "$NODE_DIR/vercel/index.ts" "Vercel AI SDK Provider (Node.js)"

# ── 7. 文档检查 ──
h2 "7. 文档"

check_file "$SDK_DIR/aihub-python/INTEGRATIONS.md" "Python SDK INTEGRATIONS.md"
check_file "$SDK_DIR/aihub-python/examples/crewai_demo.py" "CrewAI example"
check_file "$SDK_DIR/aihub-python/examples/llamaindex_demo.py" "LlamaIndex example"
check_file "$SDK_DIR/aihub-python/examples/langchain_demo.py" "LangChain example"
check_file "$SDK_DIR/aihub-node/examples/langchain-demo.ts" "LangChain Node example"
check_file "$SDK_DIR/aihub-node/examples/vercel-demo.ts" "Vercel AI SDK example"

# ── 总结 ──
echo ""
echo "═══════════════════════════════════════"
echo "  自检完成: $PASS 通过 / $((PASS+FAIL)) 项"
echo "═══════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "✅ 所有自动化检查项通过！"
  echo ""
  echo "📋 还需要手动验证的项："
  echo "   1. 在 admin-console (http://localhost:3001) 配置一个真实 Provider API Key"
  echo "   2. 用 curl 发一次真实的 Chat Completion"
  echo "   3. 安装 @langchain/core 后运行 examples/langchain-demo.ts"
  echo "   4. 安装 ai + @ai-sdk/openai 后运行 examples/vercel-demo.ts"
  echo "   5. 安装 crewai + crewai-tools 后运行 examples/crewai_demo.py"
  echo "   6. 在 Dify/Coze 中配置 OneLLM 为 OpenAI 兼容供应商"
  echo "   7. 打开 http://localhost:5173/integrations 检查页面渲染"
  echo "   8. 打开 http://localhost:5173/docs 展开各框架指南"
else
  echo ""
  echo "⚠️  有 $FAIL 项未通过，请检查上述输出。"
fi
