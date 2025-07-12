#!/usr/bin/env python3
import os
import sys

def fix_quotes_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Словарь замен
        replacements = {
            ''': "'",
            ''': "'",
            '"': '"',
            '"': '"',
            '"': '"',
            '`': '`',
            '´': '`',
            '"': '"'
        }
        
        # Выполняем замены
        original_content = content
        for old, new in replacements.items():
            content = content.replace(old, new)
        
        # Записываем только если были изменения
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"Error fixing {filepath}: {e}")
        return False

# Обходим все файлы
fixed_count = 0
for root, dirs, files in os.walk('.'):
    # Пропускаем node_modules и .next
    if 'node_modules' in root or '.next' in root:
        continue
    
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            filepath = os.path.join(root, file)
            if fix_quotes_in_file(filepath):
                fixed_count += 1

print(f"\n✅ Fixed quotes in {fixed_count} files!")
