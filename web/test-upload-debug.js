#!/usr/bin/env node
console.log("Testing upload debug script...")
console.log("Environment check:")
console.log("OG_STORAGE_PRIVATE_KEY:", process.env.OG_STORAGE_PRIVATE_KEY ? "SET" : "NOT SET")
console.log("NEXT_PUBLIC_0G_STORAGE_URL:", process.env.NEXT_PUBLIC_0G_STORAGE_URL || "NOT SET")
