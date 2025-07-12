#!/bin/bash

# Функция для исправления кавычек в файле
fix_file() {
    if [ -f "$1" ]; then
        # Заменяем типографские кавычки на обычные
        sed -i "s/'/'/g" "$1"
        sed -i "s/'/'/g" "$1"
        sed -i 's/"/"/g' "$1"
        sed -i 's/"/"/g' "$1"
        echo "Fixed: $1"
    fi
}

# Исправляем все TypeScript и JavaScript файлы
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | while read file; do
    fix_file "$file"
done

echo "All files fixed!"
