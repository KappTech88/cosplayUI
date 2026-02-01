import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  Check,
  Download,
  RefreshCw,
  Wand2,
  ImageIcon,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";

type Step = "upload" | "prompt" | "confirm" | "generate" | "result";

interface CharacterInfo {
  name: string;
  source: string;
  sourceType: string;
  outfitDescription: string;
  props: string[];
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.cosplay.uploadImage.useMutation();
  const analyzeMutation = trpc.cosplay.analyzeCharacter.useMutation();
  const generateMutation = trpc.cosplay.generateCosplay.useMutation();

  const steps = [
    { id: "upload", label: "Upload Photo", icon: Upload },
    { id: "prompt", label: "Describe Character", icon: Wand2 },
    { id: "confirm", label: "Confirm Details", icon: Check },
    { id: "generate", label: "Generate", icon: Sparkles },
    { id: "result", label: "Result", icon: ImageIcon },
  ];

  // Memoize step order and index map for O(1) lookups
  const stepIndexMap = useMemo(() => {
    const map = new Map<Step, number>();
    map.set("upload", 0);
    map.set("prompt", 1);
    map.set("confirm", 2);
    map.set("generate", 3);
    map.set("result", 4);
    return map;
  }, []);

  const getStepStatus = useCallback((stepId: string) => {
    const currentIndex = stepIndexMap.get(currentStep) ?? 0;
    const stepIndex = stepIndexMap.get(stepId as Step) ?? 0;
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  }, [currentStep, stepIndexMap]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setUploadedFile(file);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUploadComplete = async () => {
    if (!uploadedFile || !uploadedImage) return;

    try {
      await uploadMutation.mutateAsync({
        imageData: uploadedImage,
        fileName: uploadedFile.name,
      });
      setCurrentStep("prompt");
    } catch (error) {
      toast.error("Failed to upload image. Please try again.");
    }
  };

  const handleAnalyzeCharacter = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe the character you want to cosplay as");
      return;
    }

    try {
      const result = await analyzeMutation.mutateAsync({ prompt });
      setCharacterInfo(result);
      setCurrentStep("confirm");
    } catch (error) {
      toast.error("Failed to analyze character. Please try again.");
    }
  };

  const handleGenerateCosplay = async () => {
    if (!characterInfo || !uploadedImage) return;

    setCurrentStep("generate");

    try {
      const result = await generateMutation.mutateAsync({
        characterInfo,
        userImageUrl: uploadMutation.data?.url || "",
      });
      setGeneratedImage(result.imageUrl);
      setCurrentStep("result");
    } catch (error) {
      toast.error("Failed to generate cosplay image. Please try again.");
      setCurrentStep("confirm");
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `cosplay-${characterInfo?.name || "image"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded successfully!");
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setUploadedImage(null);
    setUploadedFile(null);
    setPrompt("");
    setCharacterInfo(null);
    setGeneratedImage(null);
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="py-8 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-3">
              Cosplay Generator
            </h1>
            <p className="text-muted-foreground text-lg">
              Transform yourself into your favorite character with AI
            </p>
          </motion.div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="container max-w-4xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: status === "active" ? 1.1 : 1,
                    }}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      status === "completed"
                        ? "step-completed"
                        : status === "active"
                        ? "step-active glow-primary"
                        : "step-pending"
                    }`}
                  >
                    {status === "completed" ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Icon
                        className={`w-5 h-5 ${
                          status === "active"
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    )}
                  </motion.div>
                  <span
                    className={`text-xs mt-2 hidden md:block ${
                      status === "active"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 md:w-16 lg:w-24 h-0.5 mx-2 transition-colors duration-300 ${
                      getStepStatus(steps[index + 1].id) !== "pending"
                        ? "bg-primary"
                        : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 pb-16">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {currentStep === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="gradient-card border-border/50">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-semibold mb-6 text-center">
                    Upload Your Photo
                  </h2>

                  <div
                    className={`upload-zone rounded-xl p-12 text-center cursor-pointer transition-elegant ${
                      isDragging ? "drag-over" : ""
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />

                    {uploadedImage ? (
                      <div className="space-y-4">
                        <div className="relative inline-block">
                          <img
                            src={uploadedImage}
                            alt="Uploaded preview"
                            className="max-h-64 rounded-lg mx-auto shadow-lg"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImage(null);
                              setUploadedFile(null);
                            }}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/80 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-muted-foreground">
                          {uploadedFile?.name}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-20 h-20 mx-auto rounded-full bg-secondary flex items-center justify-center">
                          <Upload className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-medium">
                            Drop your photo here
                          </p>
                          <p className="text-muted-foreground">
                            or click to browse
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Supports JPG, PNG, WebP (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button
                      size="lg"
                      onClick={handleUploadComplete}
                      disabled={!uploadedImage || uploadMutation.isPending}
                      className="glow-primary"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Prompt */}
          {currentStep === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="gradient-card border-border/50">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-semibold mb-6 text-center">
                    Describe Your Cosplay Character
                  </h2>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <p className="text-muted-foreground mb-4">Your photo:</p>
                      <img
                        src={uploadedImage!}
                        alt="Your photo"
                        className="rounded-lg shadow-lg max-h-80 mx-auto"
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Who do you want to cosplay as?
                        </label>
                        <Textarea
                          placeholder="e.g., Goku from Dragon Ball Z, Link from The Legend of Zelda, Spider-Man from Marvel Comics..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          className="min-h-32 bg-background/50"
                        />
                      </div>

                      <div className="bg-secondary/50 rounded-lg p-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          Tips for best results
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Include the character's full name</li>
                          <li>• Mention the source (game, anime, movie, etc.)</li>
                          <li>• Specify any particular outfit or version</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("upload")}
                    >
                      Back
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleAnalyzeCharacter}
                      disabled={!prompt.trim() || analyzeMutation.isPending}
                      className="glow-primary"
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Analyze Character
                          <Wand2 className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {currentStep === "confirm" && characterInfo && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="gradient-card border-border/50">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-semibold mb-6 text-center">
                    Confirm Character Details
                  </h2>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <p className="text-muted-foreground mb-4">Your photo:</p>
                      <img
                        src={uploadedImage!}
                        alt="Your photo"
                        className="rounded-lg shadow-lg max-h-64 mx-auto"
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="bg-secondary/30 rounded-xl p-6 space-y-4">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            Character Name
                          </span>
                          <p className="text-xl font-semibold text-gradient">
                            {characterInfo.name}
                          </p>
                        </div>

                        <div>
                          <span className="text-sm text-muted-foreground">
                            Source
                          </span>
                          <p className="font-medium">
                            {characterInfo.source}{" "}
                            <span className="text-muted-foreground">
                              ({characterInfo.sourceType})
                            </span>
                          </p>
                        </div>

                        <div>
                          <span className="text-sm text-muted-foreground">
                            Outfit Description
                          </span>
                          <p className="text-foreground/90">
                            {characterInfo.outfitDescription}
                          </p>
                        </div>

                        {characterInfo.props.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">
                              Props & Accessories
                            </span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {characterInfo.props.map((prop, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm"
                                >
                                  {prop}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-accent/10 rounded-lg border border-accent/30">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium text-accent">
                          Please confirm these details are correct
                        </p>
                        <p className="text-sm text-muted-foreground">
                          If the character information doesn't match what you
                          intended, go back and provide more specific details.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("prompt")}
                    >
                      Back & Edit
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleGenerateCosplay}
                      className="glow-primary"
                    >
                      Confirm & Generate
                      <Sparkles className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Generating */}
          {currentStep === "generate" && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="gradient-card border-border/50">
                <CardContent className="p-12">
                  <div className="text-center space-y-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-24 h-24 mx-auto rounded-full step-active glow-primary flex items-center justify-center"
                    >
                      <Sparkles className="w-12 h-12 text-primary-foreground" />
                    </motion.div>

                    <div>
                      <h2 className="text-2xl font-semibold mb-2">
                        Creating Your Cosplay
                      </h2>
                      <p className="text-muted-foreground">
                        AI is transforming you into {characterInfo?.name}...
                      </p>
                    </div>

                    <div className="max-w-md mx-auto">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-accent"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 15, ease: "linear" }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        This may take up to 30 seconds...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Result */}
          {currentStep === "result" && generatedImage && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="gradient-card border-border/50">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-semibold mb-6 text-center">
                    Your Cosplay is Ready!
                  </h2>

                  <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div>
                      <p className="text-muted-foreground mb-4 text-center">
                        Original
                      </p>
                      <img
                        src={uploadedImage!}
                        alt="Original photo"
                        className="rounded-lg shadow-lg max-h-96 mx-auto"
                      />
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-4 text-center">
                        As {characterInfo?.name}
                      </p>
                      <div className="relative">
                        <img
                          src={generatedImage}
                          alt="Generated cosplay"
                          className="rounded-lg shadow-lg glow-accent max-h-96 mx-auto"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                    <Button
                      size="lg"
                      onClick={handleDownload}
                      className="glow-primary"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Image
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset}>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground text-sm">
        <p>Powered by AI • Transform your imagination into reality</p>
      </footer>
    </div>
  );
}
