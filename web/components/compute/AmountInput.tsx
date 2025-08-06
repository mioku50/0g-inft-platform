'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  error?: string
}

// Regex for validating OG amount: digits with optional decimal (up to 18 places)
const AMOUNT_REGEX = /^\d+(\.\d{0,18})?$/

export function AmountInput({
  value,
  onChange,
  label = 'Amount (OG)',
  placeholder = '0.01',
  min = '0',
  max,
  disabled = false,
  error: externalError
}: AmountInputProps) {
  const [internalError, setInternalError] = useState<string>('')
  
  const error = externalError || internalError

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    // Allow empty string
    if (newValue === '') {
      onChange('')
      setInternalError('')
      return
    }
    
    // Validate format
    if (!AMOUNT_REGEX.test(newValue)) {
      return // Don't update if invalid format
    }
    
    // Validate range
    const numValue = parseFloat(newValue)
    if (!isNaN(numValue)) {
      if (min && numValue < parseFloat(min)) {
        setInternalError(`Minimum amount is ${min} OG`)
      } else if (max && numValue > parseFloat(max)) {
        setInternalError(`Maximum amount is ${max} OG`)
      } else {
        setInternalError('')
      }
    }
    
    onChange(newValue)
  }
  
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="amount-input">{label}</Label>
      )}
      <Input
        id="amount-input"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={error ? 'border-red-500' : ''}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}