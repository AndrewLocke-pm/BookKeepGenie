import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings } from "lucide-react";

const taxProfileSchema = z.object({
  legalForm: z.enum(['sole_proprietor', 'partnership', 'company', 'trust']),
  financialYearEnd: z.coerce.number().min(1).max(12),
  accountingBasis: z.enum(['accrual', 'cash']),
  vatRegistered: z.boolean(),
  vatNumber: z.string().optional().nullable(),
  vatPeriod: z.enum(['monthly', 'bimonthly']).optional().nullable(),
});

type TaxProfileFormValues = z.infer<typeof taxProfileSchema>;

export default function TaxSettings() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/tax/profile'],
  });

  const form = useForm<TaxProfileFormValues>({
    resolver: zodResolver(taxProfileSchema),
    defaultValues: {
      legalForm: 'sole_proprietor',
      financialYearEnd: 2,
      accountingBasis: 'accrual',
      vatRegistered: false,
      vatNumber: '',
      vatPeriod: 'monthly',
    },
  });

  // Reset form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        legalForm: profile.legalForm || 'sole_proprietor',
        financialYearEnd: profile.financialYearEnd || 2,
        accountingBasis: profile.accountingBasis || 'accrual',
        vatRegistered: profile.vatRegistered || false,
        vatNumber: profile.vatNumber || '',
        vatPeriod: profile.vatPeriod || 'monthly',
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: TaxProfileFormValues) => {
      return await apiRequest('POST', '/api/tax/profile', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax/profile'] });
      toast({
        title: "Tax profile saved",
        description: "Your tax settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving tax profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: TaxProfileFormValues) => {
    saveMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Tax Settings</h1>
          <p className="text-muted-foreground">Configure your South African tax compliance settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Profile</CardTitle>
          <CardDescription>
            Set up your tax information for accurate VAT201 and IRP6 calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="legalForm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Form</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-legal-form">
                          <SelectValue placeholder="Select legal form" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="company">Company (Pty Ltd)</SelectItem>
                        <SelectItem value="trust">Trust</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Your business structure for tax purposes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="financialYearEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial Year End (Month)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger data-testid="select-financial-year-end">
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {new Date(2000, month - 1).toLocaleDateString('en-ZA', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Month when your financial year ends (SARS standard is February)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountingBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounting Basis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-accounting-basis">
                          <SelectValue placeholder="Select accounting basis" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="accrual">Accrual</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How you recognize income and expenses
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">VAT Registration</h3>
                
                <FormField
                  control={form.control}
                  name="vatRegistered"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-4">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                          data-testid="input-vat-registered"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>VAT Registered</FormLabel>
                        <FormDescription>
                          Check if your business is registered for VAT with SARS
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch('vatRegistered') && (
                  <>
                    <FormField
                      control={form.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="4123456789" 
                              {...field} 
                              value={field.value || ''}
                              data-testid="input-vat-number"
                            />
                          </FormControl>
                          <FormDescription>
                            Your 10-digit SARS VAT registration number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vatPeriod"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>VAT Filing Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'monthly'}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vat-filing-frequency">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="bimonthly">Bi-monthly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            How often you file VAT returns with SARS
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  data-testid="button-save-tax-profile"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Tax Profile
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
