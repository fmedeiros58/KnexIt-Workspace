import { buildComposerRagContract } from "@/core/rag/contracts/composer_rag_contract";

describe("buildComposerRagContract", () => {
  it("mantem escopo dos anexos do composer para consulta normal", () => {
    const contract = buildComposerRagContract({
      question: "considere este anexo e responda com base nele",
      composerBound: true,
      composerAttachmentIds: [101, 202],
    });

    expect(contract.scopeMode).toBe("composer_strict");
    expect(contract.documentIds).toEqual([101, 202]);
    expect(contract.priorityDocumentIds).toEqual([101, 202]);
    expect(contract.strictDocumentGrounding).toBe(true);
  });

  it("preserva escopo dos anexos mesmo em modo blend composer+rag", () => {
    const contract = buildComposerRagContract({
      question: "resuma este arquivo e tambem considere a base rag",
      composerBound: true,
      composerAttachmentIds: [55],
    });

    expect(contract.scopeMode).toBe("composer_plus_rag");
    expect(contract.documentIds).toEqual([55]);
    expect(contract.priorityDocumentIds).toEqual([55]);
    expect(contract.strictDocumentGrounding).toBe(false);
  });
});
