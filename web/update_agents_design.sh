#!/bin/bash

# Update agents page design
cd /workspace/web

# Update card styling
sed -i 's/bg-white\/80 backdrop-blur border-purple-200 hover:shadow-xl transition-all duration-300 overflow-hidden/bg-white\/80 dark:bg-black\/40 backdrop-blur-xl border border-white\/20 shadow-xl rounded-2xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden/' app/agents/page.tsx

# Update header container
sed -i 's/<div className="mb-8 flex items-center justify-between">/<div className="mb-8"><div className="bg-white\/80 dark:bg-black\/40 backdrop-blur-xl border border-white\/20 shadow-xl rounded-2xl p-6"><div className="flex items-center justify-between">/' app/agents/page.tsx

# Update header close
sed -i 's/<\/div><\/div>/<\/div><\/div><\/div><\/div>/' app/agents/page.tsx

# Update button colors
sed -i 's/border-purple-200 hover:bg-purple-50 text-gray-700/border-white\/20 hover:bg-white\/10 text-gray-700 dark:text-gray-200/g' app/agents/page.tsx
sed -i 's/bg-white\/70 backdrop-blur border-purple-200 text-gray-700 hover:bg-white\/90/bg-white\/20 dark:bg-black\/20 backdrop-blur border-white\/20 text-gray-700 dark:text-gray-200 hover:bg-white\/30/' app/agents/page.tsx
sed -i 's/from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700/from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700/g' app/agents/page.tsx

# Update icon colors
sed -i 's/text-purple-600/text-blue-600/g' app/agents/page.tsx

# Update empty state card
sed -i 's/bg-white\/80 backdrop-blur border-purple-200 p-12/bg-white\/80 dark:bg-black\/40 backdrop-blur-xl border border-white\/20 shadow-xl rounded-2xl p-12/' app/agents/page.tsx

# Update text colors for dark mode
sed -i 's/text-gray-900/text-gray-900 dark:text-white/g' app/agents/page.tsx
sed -i 's/text-gray-600/text-gray-600 dark:text-gray-300/g' app/agents/page.tsx

echo "Agents page design updated successfully!"