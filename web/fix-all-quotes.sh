#!/bin/bash

echo "Fixing quotes in all TypeScript/JavaScript files..."

# Счетчик файлов
count=0

# Находим и исправляем все файлы
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | while read file; do
    if [ -f "$file" ]; then
        # Заменяем все виды неправильных кавычек
        sed -i "s/'/'/g" "$file"
        sed -i "s/'/'/g" "$file"
        sed -i 's/"/"/g' "$file"
        sed -i 's/"/"/g' "$file"
        sed -i "s/'/'/g" "$file"  # На всякий случай еще раз
        
        count=$((count + 1))
        echo "Fixed: $file"
    fi
done

echo ""
echo "✅ Fixed quotes in $count files!"
