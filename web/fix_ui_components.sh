#!/bin/bash

# Функция для исправления файла
fix_file() {
    local file=$1
    echo "Fixing: $file"
    
    # Создаем временный файл
    temp_file="${file}.tmp"
    
    # Заменяем все проблемные символы
    sed 's/[""]/"/g; s/['']/'"'"'/g; s/"/"/g; s/'/'"'"'/g' "$file" > "$temp_file"
    
    # Дополнительно убираем невидимые символы
    iconv -f utf-8 -t utf-8 -c "$temp_file" > "${temp_file}.clean"
    
    # Перемещаем обратно
    mv "${temp_file}.clean" "$file"
    rm -f "$temp_file"
}

# Исправляем все проблемные файлы
for file in components/ui/*.tsx components/ui/*.ts; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo "All UI components fixed!"
