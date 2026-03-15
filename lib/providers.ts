import { prisma } from "@/lib/db";

const DEFAULT_PROVIDERS = [
  { key: "openai", name: "OpenAI (GPT)", supportsAutoSync: true },
  { key: "gemini", name: "Google Gemini", supportsAutoSync: true },
  { key: "anthropic", name: "Anthropic Claude", supportsAutoSync: true },
  { key: "cursor", name: "Cursor", supportsAutoSync: true },
  { key: "trae", name: "Trae", supportsAutoSync: false },
  { key: "deepseek", name: "DeepSeek", supportsAutoSync: false },
  { key: "openrouter", name: "OpenRouter", supportsAutoSync: false },
  { key: "xai", name: "xAI (Grok)", supportsAutoSync: false },
  { key: "azure-openai", name: "Azure OpenAI", supportsAutoSync: false },
  { key: "perplexity", name: "Perplexity", supportsAutoSync: true },
  { key: "cohere", name: "Cohere", supportsAutoSync: true },
  { key: "mistral", name: "Mistral", supportsAutoSync: true },
  { key: "replicate", name: "Replicate", supportsAutoSync: true },
  { key: "groq", name: "Groq", supportsAutoSync: true },
  { key: "together", name: "Together AI", supportsAutoSync: false },
  { key: "fireworks", name: "Fireworks AI", supportsAutoSync: false },
  { key: "moonshot", name: "Moonshot Kimi", supportsAutoSync: false },
  { key: "bailian", name: "Alibaba Bailian", supportsAutoSync: false },
  { key: "doubao", name: "Doubao", supportsAutoSync: false },
];

export async function ensureProviders() {
  for (const provider of DEFAULT_PROVIDERS) {
    await prisma.provider.upsert({
      where: { key: provider.key },
      update: { name: provider.name, supportsAutoSync: provider.supportsAutoSync },
      create: provider,
    });
  }
}
