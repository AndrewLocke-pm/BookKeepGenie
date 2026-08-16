import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Download, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface VatPeriod {
  key: string;
  startDate: string;
  endDate: string;
  label: string;
}

export default function Vat201() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<VatPeriod | null>(null);
  const [vatResult, setVatResult] = useState<any>(null);

  const { data: periods, isLoading: periodsLoading } = useQuery<VatPeriod[]>({
    queryKey: ['/api/vat/periods'],
  });

  const { data: returns } = useQuery({
    queryKey: ['/api/vat/returns'],
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod) throw new Error("No period selected");
      
      return await apiRequest('POST', '/api/vat/calculate', {
        startDate: selectedPeriod.startDate,
        endDate: selectedPeriod.endDate,
      });
    },
    onSuccess: (data) => {
      setVatResult(data);
      toast({
        title: "VAT calculated",
        description: "VAT201 calculation complete for selected period.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error calculating VAT",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !vatResult) throw new Error("No calculation to finalize");
      
      return await apiRequest('POST', '/api/vat/finalize', {
        periodKey: selectedPeriod.key,
        startDate: selectedPeriod.startDate,
        endDate: selectedPeriod.endDate,
        outputVat: vatResult.outputVatCents,
        inputVat: vatResult.inputVatCents,
        netVat: vatResult.netVatCents,
        worksheet: vatResult,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/returns'] });
      toast({
        title: "VAT return filed",
        description: "VAT201 return has been saved successfully.",
      });
      setVatResult(null);
      setSelectedPeriod(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error filing VAT return",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod || !vatResult) throw new Error("No calculation to export");
      
      const response = await fetch('/api/vat/export/csv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedPeriod.startDate,
          endDate: selectedPeriod.endDate,
          vatResult,
        }),
      });

      if (!response.ok) throw new Error("Failed to export CSV");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vat201_${selectedPeriod.key}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "CSV exported",
        description: "VAT201 audit trail has been downloaded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error exporting CSV",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (periodsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAlreadyFiled = selectedPeriod && returns?.some((r: any) => r.periodKey === selectedPeriod.key);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">VAT201 Returns</h1>
          <p className="text-muted-foreground">Calculate and file your South African VAT returns</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select VAT Period</CardTitle>
          <CardDescription>Choose a period to calculate VAT liability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select 
              onValueChange={(key) => {
                const period = periods?.find(p => p.key === key);
                setSelectedPeriod(period || null);
                setVatResult(null);
              }}
              value={selectedPeriod?.key}
            >
              <SelectTrigger className="max-w-md" data-testid="select-vat-period">
                <SelectValue placeholder="Select a VAT period" />
              </SelectTrigger>
              <SelectContent>
                {periods?.map((period) => (
                  <SelectItem key={period.key} value={period.key}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => calculateMutation.mutate()}
              disabled={!selectedPeriod || calculateMutation.isPending || isAlreadyFiled}
              data-testid="button-calculate-vat"
            >
              {calculateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Calculate VAT
            </Button>
          </div>

          {isAlreadyFiled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>VAT return already filed for this period</span>
            </div>
          )}
        </CardContent>
      </Card>

      {vatResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>VAT201 Summary</CardTitle>
              <CardDescription>
                Period: {selectedPeriod?.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Output VAT (Sales)</p>
                  <p className="text-2xl font-bold font-mono" data-testid="text-output-vat">
                    R {(vatResult.outputVatCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Input VAT (Purchases)</p>
                  <p className="text-2xl font-bold font-mono" data-testid="text-input-vat">
                    R {(vatResult.inputVatCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Net VAT {vatResult.netVatCents >= 0 ? 'Payable' : 'Refundable'}</p>
                  <p className={`text-2xl font-bold font-mono ${vatResult.netVatCents >= 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="text-net-vat">
                    R {(vatResult.netVatCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <h3 className="font-medium">VAT201 Box Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard-rated supplies:</span>
                    <span className="font-mono">R {(vatResult.standardRatedSuppliesCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zero-rated supplies:</span>
                    <span className="font-mono">R {(vatResult.zeroRatedSuppliesCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard acquisitions (input VAT):</span>
                    <span className="font-mono">R {(vatResult.standardRatedAcquisitionsCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital goods (input VAT):</span>
                    <span className="font-mono">R {(vatResult.capitalGoodsCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => finalizeMutation.mutate()}
                  disabled={finalizeMutation.isPending}
                  data-testid="button-file-vat-return"
                >
                  {finalizeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  File VAT Return
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportCsvMutation.mutate()}
                  disabled={exportCsvMutation.isPending}
                  data-testid="button-export-vat-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Audit Trail</CardTitle>
              <CardDescription>Detailed breakdown of all transactions in this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tax Code</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatResult.auditRows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.date}</TableCell>
                        <TableCell>{row.vendor}</TableCell>
                        <TableCell>
                          <Badge variant={row.type === 'income' ? 'default' : 'secondary'}>
                            {row.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.taxCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          R {(row.amountCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          R {(row.vatAmountCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {returns && returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filed VAT Returns</CardTitle>
            <CardDescription>History of your submitted VAT201 returns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Filed Date</TableHead>
                    <TableHead className="text-right">Output VAT</TableHead>
                    <TableHead className="text-right">Input VAT</TableHead>
                    <TableHead className="text-right">Net VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret: any) => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-medium">{ret.periodKey}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(ret.submittedAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R {(parseFloat(ret.outputVat) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R {(parseFloat(ret.inputVat) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${parseFloat(ret.netVat) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        R {(parseFloat(ret.netVat) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
