import { SignInButton } from '@clerk/clerk-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Sparkles, BarChart3, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold">AI Bookkeeper</span>
          </div>
          <SignInButton mode="modal">
            <Button data-testid="button-login">Log In</Button>
          </SignInButton>
        </div>
      </header>

      <main>
        <section className="py-24 md:py-32">
          <div className="container max-w-7xl mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                  Smart Bookkeeping with AI
                </h1>
                <p className="text-xl text-muted-foreground">
                  Upload receipts and invoices. Let AI extract the details. 
                  Manage your finances effortlessly.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignInButton mode="modal">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started Free
                  </Button>
                </SignInButton>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/50">
          <div className="container max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="space-y-0 pb-4">
                  <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">AI-Powered Extraction</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Automatically extract vendor, amount, date, and category from receipt images using advanced AI vision.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-0 pb-4">
                  <div className="w-12 h-12 rounded-md bg-chart-2/10 flex items-center justify-center mb-4">
                    <Receipt className="w-6 h-6 text-chart-2" />
                  </div>
                  <CardTitle className="text-lg">Natural Language Input</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Simply say "drinks with clients $45" and AI understands the context and categorizes automatically.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-0 pb-4">
                  <div className="w-12 h-12 rounded-md bg-chart-3/10 flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-chart-3" />
                  </div>
                  <CardTitle className="text-lg">Smart Categorization</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Automatically categorize expenses into meals, office supplies, payroll, travel, and more.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-0 pb-4">
                  <div className="w-12 h-12 rounded-md bg-chart-4/10 flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-chart-4" />
                  </div>
                  <CardTitle className="text-lg">Save Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Process bulk uploads of invoices and receipts in seconds instead of hours of manual entry.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container max-w-7xl mx-auto px-4 md:px-6">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <h2 className="text-3xl font-bold">Ready to simplify your bookkeeping?</h2>
              <p className="text-lg text-muted-foreground">
                Join professionals who trust AI to manage their financial records accurately and efficiently.
              </p>
              <SignInButton mode="modal">
                <Button size="lg" data-testid="button-start-now">
                  Start Now
                </Button>
              </SignInButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container max-w-7xl mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 AI Bookkeeper. Powered by advanced AI technology.</p>
        </div>
      </footer>
    </div>
  );
}
