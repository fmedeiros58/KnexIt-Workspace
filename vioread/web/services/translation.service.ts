import "server-only";

import OpenAI from "openai";
import { MAX_TRANSLATION_BLOCKS_PER_REQUEST } from "../lib/constants";
import type { TranslationPair } from "../lib/types";

type TranslateBlockInput = {
  id: string;
  text: string;
};

type TranslateBlocksArgs = {
  sourceLanguage: string;
  targetLanguage: string;
  blocks: TranslateBlockInput[];
};

const modelName = process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini";
const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
const openaiClient = apiKey ? new OpenAI({ apiKey }) : null;

function fallbackTranslate(args: TranslateBlocksArgs): TranslationPair[] {
  return args.blocks.map((block) => ({
    blockId: block.id,
    originalText: block.text,
    translatedText: `[${args.targetLanguage}] ${block.text}`,
  }));
}

function chunkBlocks(blocks: TranslateBlockInput[], chunkSize: number) {
  const chunks: TranslateBlockInput[][] = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }
  return chunks;
}

function parseOpenAiJson(content: string, expectedBlocks: TranslateBlockInput[], targetLanguage: string): TranslationPair[] {
  try {
    const parsed = JSON.parse(content) as {
      translations?: Array<{ id?: string; translatedText?: string }>;
    };

    const translatedById = new Map(
      (parsed.translations ?? [])
        .filter((item) => item?.id && typeof item.translatedText === "string")
        .map((item) => [String(item.id), String(item.translatedText)] as const),
    );

    return expectedBlocks.map((block) => ({
      blockId: block.id,
      originalText: block.text,
      translatedText: translatedById.get(block.id) ?? `[${targetLanguage}] ${block.text}`,
    }));
  } catch {
    return expectedBlocks.map((block) => ({
      blockId: block.id,
      originalText: block.text,
      translatedText: `[${targetLanguage}] ${block.text}`,
    }));
  }
}

async function translateChunkWithOpenAI(args: {
  sourceLanguage: string;
  targetLanguage: string;
  blocks: TranslateBlockInput[];
}): Promise<TranslationPair[]> {
  if (!openaiClient) {
    return fallbackTranslate({
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      blocks: args.blocks,
    });
  }

  const completion = await openaiClient.chat.completions.create({
    model: modelName,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You translate academic PDF text blocks. Keep references, numbers, formulas, and inline citations exactly. Return JSON only with {\"translations\":[{\"id\":\"...\",\"translatedText\":\"...\"}]}",
      },
      {
        role: "user",
        content: JSON.stringify({
          sourceLanguage: args.sourceLanguage,
          targetLanguage: args.targetLanguage,
          blocks: args.blocks,
        }),
      },
    ],
  });

  const messageContent = completion.choices?.[0]?.message?.content ?? "{}";
  return parseOpenAiJson(messageContent, args.blocks, args.targetLanguage);
}

export async function translateTextBlocks(args: TranslateBlocksArgs): Promise<TranslationPair[]> {
  if (!args.blocks.length) return [];
  const chunks = chunkBlocks(args.blocks, MAX_TRANSLATION_BLOCKS_PER_REQUEST);
  const translatedChunks = await Promise.all(
    chunks.map((chunk) =>
      translateChunkWithOpenAI({
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        blocks: chunk,
      }),
    ),
  );
  return translatedChunks.flat();
}

