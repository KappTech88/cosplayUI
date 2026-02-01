import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the external dependencies
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("cosplay.uploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a valid base64 image and returns URL", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const mockUrl = "https://storage.example.com/uploads/test123.jpg";
    vi.mocked(storagePut).mockResolvedValue({
      url: mockUrl,
      key: "uploads/test123.jpg",
    });

    const result = await caller.cosplay.uploadImage({
      imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
      fileName: "test.jpg",
    });

    expect(result.url).toBe(mockUrl);
    expect(result.fileKey).toContain("uploads/");
    expect(storagePut).toHaveBeenCalledOnce();
  });

  it("throws error for invalid image data format", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.cosplay.uploadImage({
        imageData: "invalid-data",
        fileName: "test.jpg",
      })
    ).rejects.toThrow("Invalid image data format");
  });
});

describe("cosplay.analyzeCharacter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("analyzes character prompt and returns character info", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const mockCharacterInfo = {
      name: "Goku",
      source: "Dragon Ball Z",
      sourceType: "Anime",
      outfitDescription:
        "Orange gi with blue undershirt, blue wristbands and boots",
      props: ["Power Pole", "Flying Nimbus"],
    };

    vi.mocked(invokeLLM).mockResolvedValue({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(mockCharacterInfo),
          },
          finish_reason: "stop",
        },
      ],
    });

    const result = await caller.cosplay.analyzeCharacter({
      prompt: "Goku from Dragon Ball Z",
    });

    expect(result.name).toBe("Goku");
    expect(result.source).toBe("Dragon Ball Z");
    expect(result.sourceType).toBe("Anime");
    expect(result.props).toContain("Power Pole");
    expect(invokeLLM).toHaveBeenCalledOnce();
  });

  it("throws error for empty prompt", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.cosplay.analyzeCharacter({
        prompt: "",
      })
    ).rejects.toThrow();
  });
});

describe("cosplay.generateCosplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates cosplay image with character info", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const mockImageUrl = "https://storage.example.com/generated/cosplay123.png";
    vi.mocked(generateImage).mockResolvedValue({
      url: mockImageUrl,
    });

    const result = await caller.cosplay.generateCosplay({
      characterInfo: {
        name: "Link",
        source: "The Legend of Zelda",
        sourceType: "Video Game",
        outfitDescription: "Green tunic with brown belt, green cap",
        props: ["Master Sword", "Hylian Shield"],
      },
      userImageUrl: "https://storage.example.com/uploads/user123.jpg",
    });

    expect(result.imageUrl).toBe(mockImageUrl);
    expect(generateImage).toHaveBeenCalledOnce();
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Link"),
        originalImages: expect.arrayContaining([
          expect.objectContaining({
            url: "https://storage.example.com/uploads/user123.jpg",
          }),
        ]),
      })
    );
  });

  it("throws error when image generation fails", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(generateImage).mockResolvedValue({
      url: undefined,
    });

    await expect(
      caller.cosplay.generateCosplay({
        characterInfo: {
          name: "Test",
          source: "Test Source",
          sourceType: "Test Type",
          outfitDescription: "Test outfit",
          props: [],
        },
        userImageUrl: "https://example.com/test.jpg",
      })
    ).rejects.toThrow("Failed to generate cosplay image");
  });
});
