'use client'
export default function TestPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">TEST PAGE WORKS!</h1>
      <p>Generated at: {new Date().toISOString()}</p>
    </div>
  )
}
