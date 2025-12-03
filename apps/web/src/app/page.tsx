"use client";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-bold text-center mb-8">Through</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Analyze and launch your development projects
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <p className="text-center text-gray-500">Loading...</p>
        </div>
      </div>
    </main>
  );
}
