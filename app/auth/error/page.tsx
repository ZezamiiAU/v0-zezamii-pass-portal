"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Something went wrong</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-muted-foreground">Error: {error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">An unexpected error occurred.</p>
        )}
        <Button asChild className="w-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<Loading />}>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  )
}
