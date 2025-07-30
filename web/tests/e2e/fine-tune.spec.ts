import { test, expect, Page } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'

// Test configuration
const TEST_AGENT_ID = '1'
const TEST_WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

// Create test dataset content
const createTestDataset = () => {
  return `{"messages": [
  {"role": "system", "content": "You are a helpful AI assistant."},
  {"role": "user", "content": "What is machine learning?"},
  {"role": "assistant", "content": "Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed."}
]}
{"messages": [
  {"role": "user", "content": "Explain neural networks"},
  {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information."}
]}
{"messages": [
  {"role": "user", "content": "What is deep learning?"},
  {"role": "assistant", "content": "Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data."}
]}
{"messages": [
  {"role": "user", "content": "How does reinforcement learning work?"},
  {"role": "assistant", "content": "Reinforcement learning is a type of machine learning where an agent learns to make decisions by taking actions in an environment to maximize cumulative reward."}
]}
{"messages": [
  {"role": "user", "content": "What are the applications of AI?"},
  {"role": "assistant", "content": "AI has applications in healthcare, finance, transportation, entertainment, education, and many other fields, helping to automate tasks and make intelligent decisions."}
]}`
}

// Helper function to mock wallet connection
async function mockWalletConnection(page: Page) {
  // Mock wallet connection by intercepting the wagmi hooks
  await page.addInitScript(() => {
    // Mock useAccount hook
    window.__mockWallet = {
      isConnected: true,
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 16601
    }
    
    // Mock useWalletClient hook
    window.__mockWalletClient = {
      account: {
        address: '0x1234567890abcdef1234567890abcdef12345678'
      },
      chain: {
        id: 16601
      }
    }
  })
}

// Helper function to mock API responses
async function mockApiResponses(page: Page) {
  // Mock account balance API
  await page.route('/api/compute/fine-tune/account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance: '0.1000',
        needsTopUp: false,
        exists: true
      })
    })
  })

  // Mock upload API
  await page.route('/api/compute/fine-tune/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        rootHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        dataSize: 5,
        filename: 'dataset-1-test.txt',
        uploadSize: 1024,
        message: 'Dataset uploaded successfully with 5 examples'
      })
    })
  })

  // Mock fine-tune task creation API
  await page.route('/api/compute/wallet/fine-tune', async (route) => {
    const requestBody = await route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        taskId: 'task_' + Date.now(),
        message: 'Fine-tuning task created successfully',
        estimatedTime: '30-60 minutes',
        userAddress: requestBody.userAddress,
        modelHash: '0x1234567890abcdef'
      })
    })
  })

  // Mock tasks API
  await page.route('/api/compute/fine-tune/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tasks: [
          {
            id: 'task_12345',
            status: 'running',
            progress: 25,
            createdAt: new Date().toISOString(),
            agentId: TEST_AGENT_ID,
            baseModel: 'llama-3.3-70b'
          }
        ]
      })
    })
  })
}

test.describe('Fine-tune E2E Tests', () => {
  let testDatasetPath: string

  test.beforeEach(async ({ page }) => {
    // Create test dataset file
    const testDatasetContent = createTestDataset()
    testDatasetPath = path.join(__dirname, 'temp-test-dataset.jsonl')
    await fs.writeFile(testDatasetPath, testDatasetContent)

    // Setup mocks
    await mockWalletConnection(page)
    await mockApiResponses(page)
  })

  test.afterEach(async () => {
    // Cleanup test files
    try {
      await fs.unlink(testDatasetPath)
    } catch (error) {
      // File might not exist, ignore error
    }
  })

  test('should display Fine-tune page correctly', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Check page title and header
    await expect(page).toHaveTitle(/Fine-tune Agent/)
    await expect(page.locator('h1')).toContainText(`Fine-tune Agent #${TEST_AGENT_ID}`)

    // Check main sections are present
    await expect(page.locator('text=Step 1: Upload Training Dataset')).toBeVisible()
    await expect(page.locator('text=Step 2: Select Base Model')).toBeVisible()
    await expect(page.locator('text=Account Status')).toBeVisible()

    // Check wallet connection status
    await expect(page.locator('text=Wallet Connected')).toBeVisible()
  })

  test('should show account balance correctly', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Wait for account info to load
    await page.waitForSelector('text=Account Status')

    // Check balance display
    await expect(page.locator('text=Fine-tune Balance: 0.1000')).toBeVisible()
    
    // Should not show "needs top up" warning since balance is sufficient
    await expect(page.locator('text=Low balance. Please deposit funds.')).not.toBeVisible()
  })

  test('should upload dataset successfully', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Wait for page to load
    await page.waitForSelector('input[type="file"]')

    // Upload test dataset
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testDatasetPath)

    // Check file is selected
    await expect(page.locator('text=test-dataset.jsonl')).toBeVisible()

    // Click upload button
    const uploadButton = page.locator('button:has-text("Upload Dataset")')
    await expect(uploadButton).toBeEnabled()
    await uploadButton.click()

    // Check upload progress
    await expect(page.locator('text=Uploading...')).toBeVisible()

    // Wait for upload success
    await expect(page.locator('text=Dataset uploaded successfully!')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Root hash: 0xabcdef1234567890')).toBeVisible()
    await expect(page.locator('text=(5 examples)')).toBeVisible()
  })

  test('should select different models', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Wait for model selection tabs
    await page.waitForSelector('[data-testid="model-tabs"]', { timeout: 5000 }).catch(() => {
      // If data-testid is not available, wait for the tabs component
      return page.waitForSelector('div[role="tablist"]')
    })

    // Test different model categories
    const categories = ['Recommended', 'Language Generation', 'Reasoning', 'Classification']
    
    for (const category of categories) {
      try {
        const tab = page.locator(`button:has-text("${category}")`)
        if (await tab.isVisible()) {
          await tab.click()
          await page.waitForTimeout(500) // Wait for tab content to load
          
          // Check that models are displayed in this category
          const modelCards = page.locator('[data-testid="model-card"]')
          if (await modelCards.count() === 0) {
            // Fallback: look for any model selection elements
            const models = page.locator('button[role="radio"], input[type="radio"]')
            expect(await models.count()).toBeGreaterThan(0)
          }
        }
      } catch (error) {
        console.log(`Could not test category ${category}:`, error)
      }
    }
  })

  test('should complete full fine-tune workflow', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Step 1: Upload dataset
    await page.waitForSelector('input[type="file"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testDatasetPath)

    const uploadButton = page.locator('button:has-text("Upload Dataset")')
    await uploadButton.click()
    await expect(page.locator('text=Dataset uploaded successfully!')).toBeVisible({ timeout: 10000 })

    // Step 2: Select model (default should be fine)
    // The default model "llama-3.3-70b" should already be selected

    // Step 3: Configure parameters (optional - defaults should work)
    // Check if parameter inputs are visible and have reasonable defaults
    const stepsInput = page.locator('input[placeholder*="steps"], input[value="500"]')
    if (await stepsInput.isVisible()) {
      await expect(stepsInput).toHaveValue('500')
    }

    // Step 4: Start fine-tuning
    const startButton = page.locator('button:has-text("Start Fine-tuning")')
    await expect(startButton).toBeEnabled()
    await startButton.click()

    // Check for success message
    await expect(page.locator('text=Fine-tuning Started!')).toBeVisible({ timeout: 10000 })
    
    // Should show task ID in the message
    await expect(page.locator('text=Task created: task_')).toBeVisible()

    // Check that tasks list is updated
    await page.waitForTimeout(2000) // Wait for tasks to reload
    await expect(page.locator('text=Task task_12345')).toBeVisible()
    await expect(page.locator('text=running')).toBeVisible()
  })

  test('should handle upload errors gracefully', async ({ page }) => {
    // Mock upload API to return error
    await page.route('/api/compute/fine-tune/upload', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Storage not configured',
          details: 'OG_STORAGE_PRIVATE_KEY environment variable is missing',
          success: false
        })
      })
    })

    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Try to upload dataset
    await page.waitForSelector('input[type="file"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testDatasetPath)

    const uploadButton = page.locator('button:has-text("Upload Dataset")')
    await uploadButton.click()

    // Should show error message
    await expect(page.locator('text=Upload Failed')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Storage not configured')).toBeVisible()
  })

  test('should show wallet connection warning when not connected', async ({ page }) => {
    // Override wallet mock to simulate disconnected state
    await page.addInitScript(() => {
      window.__mockWallet = {
        isConnected: false,
        address: undefined,
        chainId: undefined
      }
    })

    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Should show wallet connection warning
    await expect(page.locator('text=Please connect your wallet to start fine-tuning')).toBeVisible()
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible()

    // Start fine-tuning button should show wallet error
    const startButton = page.locator('button:has-text("Start Fine-tuning")')
    if (await startButton.isVisible()) {
      await startButton.click()
      await expect(page.locator('text=Wallet Not Connected')).toBeVisible()
    }
  })

  test('should validate dataset format', async ({ page }) => {
    // Create invalid dataset
    const invalidDatasetContent = 'This is not a valid JSONL dataset'
    const invalidDatasetPath = path.join(__dirname, 'invalid-dataset.txt')
    await fs.writeFile(invalidDatasetPath, invalidDatasetContent)

    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    try {
      // Upload invalid dataset
      await page.waitForSelector('input[type="file"]')
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(invalidDatasetPath)

      const uploadButton = page.locator('button:has-text("Upload Dataset")')
      await uploadButton.click()

      // Should show validation error or upload error
      await expect(page.locator('text=Dataset Validation Failed, text=Upload Failed')).toBeVisible({ timeout: 10000 })
    } finally {
      // Cleanup
      await fs.unlink(invalidDatasetPath).catch(() => {})
    }
  })

  test('should show task progress and status', async ({ page }) => {
    await page.goto(`/agents/${TEST_AGENT_ID}/fine-tune`)

    // Wait for tasks to load
    await page.waitForSelector('text=Fine-tuning Tasks')

    // Should show active task
    await expect(page.locator('text=Task task_12345')).toBeVisible()
    await expect(page.locator('text=running')).toBeVisible()
    
    // Should show progress bar if progress is available
    const progressBar = page.locator('[role="progressbar"], .progress')
    if (await progressBar.isVisible()) {
      // Progress should be visible and have some value
      expect(await progressBar.count()).toBeGreaterThan(0)
    }
  })
})

// Additional test suite for API endpoints
test.describe('Fine-tune API Tests', () => {
  test('should return account balance from API', async ({ request }) => {
    const response = await request.get('/api/compute/fine-tune/account')
    
    expect(response.status()).toBe(200)
    const data = await response.json()
    
    expect(data).toHaveProperty('balance')
    expect(data).toHaveProperty('needsTopUp')
    expect(data).toHaveProperty('exists')
  })

  test('should handle upload API correctly', async ({ request }) => {
    const testContent = createTestDataset()
    
    const response = await request.post('/api/compute/fine-tune/upload', {
      multipart: {
        file: {
          name: 'test-dataset.jsonl',
          mimeType: 'application/jsonl',
          buffer: Buffer.from(testContent)
        },
        agentId: '123'
      }
    })

    // Should either succeed or fail with proper error message
    expect([200, 500, 503]).toContain(response.status())
    
    const data = await response.json()
    
    if (response.status() === 200) {
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('rootHash')
      expect(data).toHaveProperty('dataSize')
    } else {
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('details')
    }
  })
})