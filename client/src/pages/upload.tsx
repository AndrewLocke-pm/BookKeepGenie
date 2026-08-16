import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { CloudUpload, Sparkles, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle, AlertTriangle, Mic, MicOff, Square } from "lucide-react";
import { formatDateInput } from "@/lib/utils";
import { type Category, type AIExtractionResult } from "@shared/schema";
import { OwnerFundsDecisionModal } from "@/components/owner-funds-decision-modal";
import { TransactionSummaryModal } from "@/components/transaction-summary-modal";

// ── Voice recording state ──────────────────────────────────────────────────────
type RecordState = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'denied';

function formatDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function Upload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [naturalLanguage, setNaturalLanguage] = useState("");
  const [extractedData, setExtractedData] = useState<AIExtractionResult | null>(null);
  const [ownerFundsModalOpen, setOwnerFundsModalOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [savedTransaction, setSavedTransaction] = useState<any>(null);
  const [formData, setFormData] = useState({
    vendor: "",
    amount: "",
    date: formatDateInput(new Date()),
    description: "",
    categoryId: "",
    type: "expense" as "expense" | "income",
    taxCode: "standard" as "standard" | "zero_rated" | "exempt" | "out_of_scope",
  });

  // ── Voice recording state ────────────────────────────────────────────────────
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearRecordTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount — stops mic if user navigates away mid-recording
  useEffect(() => {
    return () => {
      clearRecordTimer();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setRecordState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Safari < 14.1 doesn't support audio/webm — fall back to audio/mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        clearRecordTimer();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        transcribeBlob(blob, mimeType || 'audio/webm');
      };
      mr.start();
      setElapsed(0);
      setRecordState('recording');
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setRecordState('denied');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecordState('transcribing');
  }

  async function transcribeBlob(blob: Blob, mimeType: string) {
    const tiApiUrl = import.meta.env.VITE_TI_API_URL;
    const tiApiKey = import.meta.env.VITE_TI_CLIENT_API_KEY;

    if (!tiApiUrl || !tiApiKey) {
      toast({
        title: "Configuration error",
        description: "Voice transcription is not configured. Contact support.",
        variant: "destructive",
      });
      setRecordState('idle');
      return;
    }

    try {
      const form = new FormData();
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      form.append('audio', blob, `recording.${ext}`);

      const res = await fetch(`${tiApiUrl}/transcribe`, {
        method: 'POST',
        headers: { 'x-api-key': tiApiKey },
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Transcription failed (${res.status})`);
      }

      const { transcript } = await res.json();

      // If there's already text in the textarea, warn before overwriting
      if (naturalLanguage.trim().length > 0) {
        const confirmed = window.confirm(
          "This will replace the existing description with the transcribed audio. Continue?"
        );
        if (!confirmed) {
          setRecordState('idle');
          return;
        }
      }

      setNaturalLanguage(transcript);
      setRecordState('idle');
      setElapsed(0);

      toast({
        title: "Transcription complete",
        description: "Your recording has been converted to text. Review it, then click Process with AI.",
      });
    } catch (err: any) {
      toast({
        title: "Transcription failed",
        description: err.message || "Could not reach transcription service.",
        variant: "destructive",
      });
      setRecordState('idle');
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────────

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(uploadedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
  });

  // ── AI process & save mutations (unchanged) ──────────────────────────────────

  const processMutation = useMutation({
    mutationFn: async () => {
      const formDataToSend = new FormData();
      if (file) {
        formDataToSend.append('file', file);
      }
      if (naturalLanguage) {
        formDataToSend.append('naturalLanguage', naturalLanguage);
      }

      const response = await fetch('/api/ai/extract', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }

      return response.json();
    },
    onSuccess: (data: AIExtractionResult) => {
      setExtractedData(data);
      setFormData({
        vendor: data.vendor,
        amount: data.amount,
        date: data.date,
        description: data.description,
        categoryId: categories?.find(c => c.name === data.category)?.id?.toString() || "",
        type: data.type ?? "expense",
        taxCode: data.taxCode ?? "standard",
      });
      toast({
        title: "AI Processing Complete",
        description: `Extracted data with ${Math.round(data.confidence * 100)}% confidence`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (forceKind?: 'capital' | 'owner_loan' | 'expense') => {
      const dataToSave = new FormData();
      if (file && extractedData) {
        dataToSave.append('receiptImage', file);
      }

      const payload: any = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        aiProcessed: extractedData ? 1 : 0,
        aiConfidence: extractedData?.confidence || null,
      };

      if (forceKind) {
        payload.forceKind = forceKind;
      }

      console.log('Saving transaction with payload:', payload);
      dataToSave.append('data', JSON.stringify(payload));

      const response = await fetch('/api/transactions', {
        method: 'POST',
        body: dataToSave,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save transaction failed:', errorText);
        throw new Error(errorText);
      }

      const responseData = await response.json();
      console.log('Save transaction response:', responseData);
      return responseData;
    },
    onSuccess: (data) => {
      if (data._requiresOwnerFundsDecision) {
        setPendingSaveData({ file, extractedData, formData });
        setOwnerFundsModalOpen(true);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setSavedTransaction(data);
      setSummaryModalOpen(true);

      setFile(null);
      setPreview(null);
      setNaturalLanguage("");
      setExtractedData(null);
      setPendingSaveData(null);
      setFormData({
        vendor: "",
        amount: "",
        date: formatDateInput(new Date()),
        description: "",
        categoryId: "",
        type: "expense",
        taxCode: "standard",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProcess = () => {
    if (!file && !naturalLanguage) {
      toast({
        title: "No Input",
        description: "Please upload an image or enter a description",
        variant: "destructive",
      });
      return;
    }
    processMutation.mutate();
  };

  const handleSave = () => {
    if (!formData.vendor || !formData.amount || !formData.date) {
      toast({
        title: "Missing Information",
        description: "Please fill in vendor, amount, and date",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleOwnerFundsDecision = (decision: 'capital' | 'owner_loan' | 'expense') => {
    saveMutation.mutate(decision);
  };

  const confidenceColor = extractedData ? 
    extractedData.confidence >= 0.9 ? 'text-chart-2' :
    extractedData.confidence >= 0.7 ? 'text-chart-3' :
    'text-destructive' : 'text-muted-foreground';

  const isRecordingActive = recordState === 'recording' || recordState === 'requesting' || recordState === 'transcribing';
  const isMutationPending = processMutation.isPending || saveMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Process Transaction</h1>
        <p className="text-muted-foreground">Upload an image or describe the transaction</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>Drop a receipt, invoice image, or PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary hover:bg-primary/5'
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} />
                <CloudUpload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-base font-medium">Drop the file here...</p>
                ) : (
                  <>
                    <p className="text-base font-medium mb-2">
                      Drop receipt images or PDFs, or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF, PDF up to 10MB
                    </p>
                  </>
                )}
              </div>

              {file && (
                <div className="mt-4 relative">
                  {file.type === 'application/pdf' ? (
                    <div className="border rounded-md p-8 text-center bg-muted/30">
                      <div className="w-16 h-16 mx-auto mb-3 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg className="w-10 h-10 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                          <text x="6" y="13" fontSize="6" fill="currentColor" fontWeight="bold">PDF</text>
                        </svg>
                      </div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <Badge className="mt-3" variant="secondary">
                        PDF uploaded
                      </Badge>
                    </div>
                  ) : preview ? (
                    <div className="relative">
                      <img 
                        src={preview} 
                        alt="Receipt preview" 
                        className="w-full rounded-md border"
                        data-testid="img-receipt-preview"
                      />
                      <Badge className="absolute top-2 right-2" variant="secondary">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Image uploaded
                      </Badge>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Natural Language + Voice Input card ───────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Natural Language Input
              </CardTitle>
              <CardDescription>
                Describe the transaction, or record it by voice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe this transaction..."
                value={naturalLanguage}
                onChange={(e) => setNaturalLanguage(e.target.value)}
                className="min-h-[120px]"
                data-testid="input-natural-language"
                disabled={isRecordingActive}
              />

              {/* ── Voice recording controls ──────────────────────────────── */}
              <div className="flex items-center gap-3">
                {recordState === 'idle' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startRecording}
                    disabled={isMutationPending}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Record instead
                  </Button>
                )}

                {recordState === 'requesting' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Requesting microphone...
                  </div>
                )}

                {recordState === 'recording' && (
                  <div className="flex items-center gap-3 w-full">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {formatDuration(elapsed)}
                    </span>
                    <span className="text-xs text-muted-foreground">Recording</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={stopRecording}
                      className="ml-auto gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Square className="w-3 h-3" fill="currentColor" />
                      Stop
                    </Button>
                  </div>
                )}

                {recordState === 'transcribing' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Transcribing audio...
                  </div>
                )}

                {recordState === 'denied' && (
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex items-center gap-2 text-sm text-destructive flex-1">
                      <MicOff className="w-3.5 h-3.5 shrink-0" />
                      Microphone access denied
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startRecording}
                      className="gap-2"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Try again
                    </Button>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleProcess}
                disabled={processMutation.isPending || (!file && !naturalLanguage) || isRecordingActive || isMutationPending}
                className="w-full"
                data-testid="button-process-ai"
              >
                {processMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Process with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Transaction Details card (unchanged) ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
            <CardDescription>
              Review and edit the extracted information
            </CardDescription>
            {extractedData && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {extractedData.confidence >= 0.9 ? (
                  <CheckCircle2 className={`w-4 h-4 ${confidenceColor}`} />
                ) : (
                  <AlertCircle className={`w-4 h-4 ${confidenceColor}`} />
                )}
                <span className={`text-sm font-medium ${confidenceColor}`}>
                  {Math.round(extractedData.confidence * 100)}% Confidence
                </span>
                <Badge variant="secondary" className="ml-auto">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Processed
                </Badge>
                {extractedData.confidence < 0.6 && (
                  <button
                    onClick={() => document.getElementById("category")?.focus()}
                    className="inline-flex w-full"
                    data-testid="badge-low-confidence-upload"
                  >
                    <Badge className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800/50 cursor-pointer">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Low confidence — please review the category
                    </Badge>
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                placeholder="Company or person name"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                data-testid="input-vendor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="font-mono"
                data-testid="input-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                data-testid="input-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-muted-foreground text-xs">(Optional)</span></Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "expense" | "income") => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Additional notes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-description"
              />
            </div>

            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full"
              data-testid="button-save-transaction"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Transaction'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Owner Funds Decision Modal */}
      <OwnerFundsDecisionModal
        open={ownerFundsModalOpen}
        onClose={() => {
          setOwnerFundsModalOpen(false);
          setPendingSaveData(null);
        }}
        onConfirm={handleOwnerFundsDecision}
        transactionDetails={{
          vendor: formData.vendor,
          description: formData.description,
          amount: formData.amount,
        }}
      />

      {/* Accounting Summary Modal */}
      <TransactionSummaryModal
        open={summaryModalOpen}
        onClose={() => {
          setSummaryModalOpen(false);
          setSavedTransaction(null);
        }}
        transaction={savedTransaction}
      />
    </div>
  );
}
