import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Configuration constants
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Schema for character info
const characterInfoSchema = z.object({
  name: z.string(),
  source: z.string(),
  sourceType: z.string(),
  outfitDescription: z.string(),
  props: z.array(z.string()),
});

export const appRouter = router({
  system: systemRouter,

  cosplay: router({
    // Upload user image to S3
    uploadImage: publicProcedure
      .input(
        z.object({
          imageData: z.string(), // base64 data URL
          fileName: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { imageData, fileName } = input;

        // Extract base64 data from data URL
        const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid image data format");
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Validate image size before conversion to prevent memory spikes
        // Base64 adds ~33% overhead, so calculate approximate buffer size
        const estimatedBufferSize = (base64Data.length * 3) / 4;
        
        if (estimatedBufferSize > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`);
        }
        
        const buffer = Buffer.from(base64Data, "base64");

        // Generate unique file key
        const ext = fileName.split(".").pop() || "jpg";
        const fileKey = `uploads/${nanoid()}.${ext}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, mimeType);

        return { url, fileKey };
      }),

    // Analyze character from user prompt
    analyzeCharacter: publicProcedure
      .input(
        z.object({
          prompt: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const { prompt } = input;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a cosplay character expert. When given a description of a character, you must identify and provide detailed information about them.

Your response MUST be a valid JSON object with these exact fields:
- name: The character's full name
- source: The name of the game, anime, movie, comic, TV show, or other media they are from
- sourceType: The type of media (e.g., "Anime", "Video Game", "Marvel Comics", "DC Comics", "Movie", "TV Series", "Manga", "Light Novel", "Sci-Fi Film", etc.)
- outfitDescription: A detailed description of their iconic outfit/costume including colors, materials, and style
- props: An array of key props, weapons, or accessories associated with this character

Be specific and accurate. If the character has multiple outfits, describe their most iconic/recognizable one unless a specific version is mentioned.`,
            },
            {
              role: "user",
              content: `Identify this cosplay character and provide their details: "${prompt}"`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "character_info",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Character's full name" },
                  source: {
                    type: "string",
                    description: "Name of the source media",
                  },
                  sourceType: {
                    type: "string",
                    description: "Type of media (Anime, Video Game, etc.)",
                  },
                  outfitDescription: {
                    type: "string",
                    description: "Detailed description of the costume",
                  },
                  props: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of props and accessories",
                  },
                },
                required: [
                  "name",
                  "source",
                  "sourceType",
                  "outfitDescription",
                  "props",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Failed to analyze character");
        }

        const parsed = JSON.parse(content);
        return characterInfoSchema.parse(parsed);
      }),

    // Generate cosplay image
    generateCosplay: publicProcedure
      .input(
        z.object({
          characterInfo: characterInfoSchema,
          userImageUrl: z.string().url(),
        })
      )
      .mutation(async ({ input }) => {
        const { characterInfo, userImageUrl } = input;

        // Build a detailed prompt for image generation
        const prompt = `Transform this person into a high-quality cosplay of ${characterInfo.name} from ${characterInfo.source}. 

The cosplay should feature: ${characterInfo.outfitDescription}

Include these props and accessories: ${characterInfo.props.join(", ")}.

Create a professional cosplay photo that maintains the person's likeness while dressing them in an accurate, detailed ${characterInfo.name} costume. The costume should look realistic and well-crafted, like a professional cosplayer's work. Maintain good lighting and a complementary background.`;

        const result = await generateImage({
          prompt,
          originalImages: [
            {
              url: userImageUrl,
              mimeType: "image/jpeg",
            },
          ],
        });

        if (!result.url) {
          throw new Error("Failed to generate cosplay image");
        }

        return { imageUrl: result.url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
