/**
 * Pricing Service
 *
 * Loads model pricing data from AI Hub's models dataset
 * and provides real-time cost calculation for each API call.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  input_cost_per_image?: number;
  max_tokens?: number;
}

interface ProviderPricing {
  [modelName: string]: ModelPricing;
}

// In-memory pricing cache
const pricingCache: Map<string, ProviderPricing> = new Map();

/**
 * Load pricing data from the pricing/ directory.
 * Called once at startup.
 */
export function loadPricingData(): void {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pricingDir = path.resolve(__dirname, '../../pricing');

    if (!fs.existsSync(pricingDir)) {
      console.warn('Pricing directory not found:', pricingDir);
      return;
    }

    const files = fs.readdirSync(pricingDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const providerName = file.replace('.json', '');
        const content = fs.readFileSync(path.join(pricingDir, file), 'utf8');
        const data = JSON.parse(content);
        pricingCache.set(providerName, data);
      } catch {
        // skip invalid files
      }
    }
    console.log(`📊 Loaded pricing data for ${pricingCache.size} providers`);
  } catch (error) {
    console.warn('Failed to load pricing data:', error);
  }
}

/**
 * Calculate cost for a model call.
 *
 * @param provider - Provider name (openai, anthropic, deepseek, etc.)
 * @param model - Model name (gpt-4o, claude-sonnet-4-6, etc.)
 * @param tokensIn - Input/prompt tokens
 * @param tokensOut - Output/completion tokens
 * @returns Cost in cents (USD)
 */
export function calculateCost(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  // Normalize provider name
  const normalizedProvider = normalizeProviderName(provider);

  const providerData = pricingCache.get(normalizedProvider);
  if (!providerData) {
    // Fallback: estimate based on tier
    return estimateCost(model, tokensIn, tokensOut);
  }

  // Try exact match, then fuzzy match
  let pricing = providerData[model];
  if (!pricing) {
    // Try matching without version suffix (e.g., gpt-4o-2024-08-06 → gpt-4o)
    const baseModel = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    pricing = providerData[baseModel];

    if (!pricing) {
      // Try prefix match
      for (const [key, val] of Object.entries(providerData)) {
        if (model.startsWith(key) || key.startsWith(model)) {
          pricing = val;
          break;
        }
      }
    }
  }

  if (pricing?.input_cost_per_token) {
    const inputCost = pricing.input_cost_per_token * tokensIn;
    const outputCost = (pricing.output_cost_per_token || pricing.input_cost_per_token * 3) * tokensOut;
    // Convert dollars to cents
    return Math.round((inputCost + outputCost) * 100);
  }

  return estimateCost(model, tokensIn, tokensOut);
}

/**
 * Fallback cost estimation when no pricing data is available.
 */
function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const modelLower = model.toLowerCase();

  // Tier-based estimation (per 1M tokens in USD)
  let inputPricePerM = 15;  // default: premium tier
  let outputPricePerM = 60;

  // Check specific providers first (before generic keywords like 'flash')
  if (modelLower.includes('deepseek')) {
    if (modelLower.includes('reasoner')) {
      inputPricePerM = 0.55; outputPricePerM = 2.19;  // DeepSeek-R1
    } else if (modelLower.includes('coder')) {
      inputPricePerM = 0.14; outputPricePerM = 0.28;  // DeepSeek-Coder
    } else {
      inputPricePerM = 0.27; outputPricePerM = 1.10;  // DeepSeek-V3/Chat (incl. flash)
    }
  } else if (modelLower.includes('qwen')) {
    inputPricePerM = 0.50; outputPricePerM = 2.00;    // Qwen
  } else if (modelLower.includes('mini') || modelLower.includes('haiku')) {
    inputPricePerM = 0.15; outputPricePerM = 0.6;
  } else if (modelLower.includes('sonnet') || modelLower.includes('gpt-4o')) {
    inputPricePerM = 3; outputPricePerM = 15;
  } else if (modelLower.includes('flash')) {
    inputPricePerM = 0.15; outputPricePerM = 0.6;
  }

  const inputCost = (tokensIn / 1_000_000) * inputPricePerM;
  const outputCost = (tokensOut / 1_000_000) * outputPricePerM;
  // Math.max(1, ...) ensures minimum 1 cent per call, never rounds to 0
  return Math.max(1, Math.round((inputCost + outputCost) * 100));
}

function normalizeProviderName(name: string): string {
  const map: Record<string, string> = {
    'openai': 'openai',
    'azure-openai': 'azure-openai',
    'anthropic': 'anthropic',
    'google': 'google',
    'deepseek': 'deepseek',
    'groq': 'groq',
    'mistral-ai': 'mistral-ai',
    'together-ai': 'together-ai',
    'x-ai': 'x-ai',
    'zhipu': 'zhipu',
    'moonshot': 'moonshot',
    'siliconflow': 'siliconflow',
    'dashscope': 'dashscope',
  };
  return map[name] || name;
}
