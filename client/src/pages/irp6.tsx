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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calculator, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function Irp6() {
  const { toast } = useToast();
  const [yoa, setYoa] = useState<number>(new Date().getFullYear() + 1);
  const [half, setHalf] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [firstHalfPayment, setFirstHalfPayment] = useState<string>('');
  const [irp6Result, setIrp6Result] = useState<any>(null);

  const { data: estimates } = useQuery({
    queryKey: ['/api/irp6/estimates'],
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error("Please select date range");
      
      return await apiRequest('POST', '/api/irp6/calculate', {
        yoa,
        half,
        startDate,
        endDate,
        firstHalfPayment: firstHalfPayment ? parseFloat(firstHalfPayment) : undefined,
      });
    },
    onSuccess: (data) => {
      setIrp6Result(data);
      toast({
        title: "IRP6 calculated",
        description: "Provisional tax estimate calculated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error calculating IRP6",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!irp6Result) throw new Error("No calculation to save");
      
      return await apiRequest('POST', '/api/irp6/save', {
        yearOfAssessment: yoa,
        half,
        taxableIncome: irp6Result.taxableIncomeCents,
        estimatedTax: irp6Result.estTaxPayableCents,
        worksheet: irp6Result.worksheet,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/irp6/estimates'] });
      toast({
        title: "IRP6 estimate saved",
        description: "Your provisional tax estimate has been saved.",
      });
      setIrp6Result(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving IRP6 estimate",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const isAlreadySaved = estimates?.some((e: any) => 
    e.yearOfAssessment === yoa && e.half === half
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">IRP6 Provisional Tax</h1>
          <p className="text-muted-foreground">Calculate your South African provisional tax liability</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provisional Tax Calculation</CardTitle>
          <CardDescription>Select year of assessment and period to calculate estimate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Year of Assessment</Label>
              <Select 
                onValueChange={(val) => setYoa(parseInt(val))}
                value={yoa.toString()}
              >
                <SelectTrigger data-testid="select-yoa">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Period (Half)</Label>
              <Select 
                onValueChange={(val) => setHalf(parseInt(val))}
                value={half.toString()}
              >
                <SelectTrigger data-testid="select-half">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">First Half (1st 6 months)</SelectItem>
                  <SelectItem value="2">Second Half (Full year)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date (YTD)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>

            {half === 2 && (
              <div className="space-y-2 md:col-span-2">
                <Label>First Half Payment (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={firstHalfPayment}
                  onChange={(e) => setFirstHalfPayment(e.target.value)}
                  data-testid="input-first-half-payment"
                />
                <p className="text-sm text-muted-foreground">
                  Amount paid in first provisional payment (for second half calculation)
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button
              onClick={() => calculateMutation.mutate()}
              disabled={!startDate || !endDate || calculateMutation.isPending || isAlreadySaved}
              data-testid="button-calculate-irp6"
            >
              {calculateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Calculate Provisional Tax
            </Button>

            {isAlreadySaved && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Estimate already saved for this period</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {irp6Result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Provisional Tax Estimate</CardTitle>
              <CardDescription>
                Year of Assessment: {yoa} - {half === 1 ? 'First' : 'Second'} Half
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Taxable Income (YTD)</p>
                  <p className="text-2xl font-bold font-mono" data-testid="text-taxable-income">
                    R {(irp6Result.taxableIncomeCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estimated Annual Tax</p>
                  <p className="text-2xl font-bold font-mono" data-testid="text-estimated-annual-tax">
                    R {(irp6Result.worksheet.estimatedTaxForYear / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Provisional Payment Due</p>
                  <p className="text-2xl font-bold font-mono text-red-600" data-testid="text-provisional-payment-due">
                    R {(irp6Result.estTaxPayableCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <h3 className="font-medium">Tax Calculation Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD Income:</span>
                    <span className="font-mono">R {(irp6Result.worksheet.ytdIncomeCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD Expenses:</span>
                    <span className="font-mono">R {(irp6Result.worksheet.ytdExpenseCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic Tax:</span>
                    <span className="font-mono">R {(irp6Result.worksheet.basicTaxCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primary Rebate:</span>
                    <span className="font-mono">R {(irp6Result.worksheet.primaryRebateCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax After Rebates:</span>
                    <span className="font-mono">R {(irp6Result.worksheet.taxAfterRebatesCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {half === 2 && irp6Result.worksheet.firstHalfPayment > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">First Half Payment:</span>
                      <span className="font-mono">R {(irp6Result.worksheet.firstHalfPayment / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-irp6"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Estimate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• This calculation uses SARS 2024/2025 tax tables and rebates.</p>
              <p>• First half payment estimates are based on annualized YTD income (50% rule).</p>
              <p>• Second half payment accounts for first half payment already made.</p>
              <p>• Ensure all transactions are categorized correctly for accurate calculation.</p>
              <p>• Consult with a tax professional for complex tax situations.</p>
            </CardContent>
          </Card>
        </>
      )}

      {estimates && estimates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved IRP6 Estimates</CardTitle>
            <CardDescription>History of your provisional tax calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year of Assessment</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Calculated Date</TableHead>
                    <TableHead className="text-right">Taxable Income</TableHead>
                    <TableHead className="text-right">Estimated Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimates.map((est: any) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium">{est.yearOfAssessment}</TableCell>
                      <TableCell>{est.half === 1 ? 'First Half' : 'Second Half'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(est.calculatedAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R {(parseFloat(est.taxableIncome) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R {(parseFloat(est.estimatedTax) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
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
