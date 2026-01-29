# PinGlass Presentation Materials

> **Дата:** 2026-01-27
> **Версия:** 1.0

---

## Структура папки

```
presentation/
├── README.md                    # Этот файл
├── PRESENTATION_PLAN.md         # План презентации (30 мин)
├── slides/
│   └── pitch-deck.html          # HTML презентация (14 слайдов)
├── assets/                      # Изображения и ресурсы
└── notes/                       # Заметки спикера
```

---

## Файлы

### PRESENTATION_PLAN.md
Полный план презентации для инвесторов и партнёров:
- Executive Summary
- Problem Statement
- Solution (3 стиля генерации, тарифы)
- **Partner Program GTM Strategy**
- Technical Architecture
- Competitive Analysis
- Demo Script

### slides/pitch-deck.html
Интерактивный HTML pitch deck с 14 слайдами:
1. Title
2. Problem
3. Solution
4. Demo (Product)
5. Pricing
6. Technology
7. Team
8. Business Model
9. Traction
10. Competitors
11. Advantages
12. **Go-to-Market (Partner Program)**
13. Financials
14. CTA / Contacts

---

## Связанные репозитории

| Репозиторий | URL | Описание |
|-------------|-----|----------|
| **PinglassDocs** | `C:\Users\bob\Projects\PinglassDocs` | Документация v6.1 |
| **Vercel Docs** | https://pinglass-docs.vercel.app | Продакшн документация |
| **Fotoset** | `C:\Users\bob\Projects\Fotoset` | Основной код |

---

## Как использовать

### Открыть презентацию локально
```bash
# Открыть pitch deck в браузере
start slides/pitch-deck.html

# Или через live server
npx serve slides/
```

### Обновить на Vercel
```bash
cd ../PinglassDocs
vercel --prod
```

---

## Partner Program GTM (Ключевые тезисы)

### Для инвесторов
- Market size: $10B AI photo market by 2027
- Unit economics: 70%+ gross margin
- Viral coefficient: partner network

### Для партнёров
- **50% комиссия** от каждой продажи
- Еженедельные выплаты (Card/СБП)
- Partner Cabinet с аналитикой
- Прогрессивная шкала до 60%

### Комиссионная структура
| Уровень | Комиссия | Требования |
|---------|----------|------------|
| Пользователь | 10% | Автоматически |
| Партнёр | 50% | Заявка + одобрение |
| VIP | 60% | 100+ рефералов |

---

## Ключевые изменения (v1.1)

### Исправленные цены
| Тариф | Было | Стало |
|-------|------|-------|
| Standard | 799 ₽ | 999 ₽ |
| Premium | 1 199 ₽ | **1 499 ₽** |

### Реальная стоимость генерации (Kie.ai)
- **Модель:** nano-banana-pro
- **Стоимость:** $0.15/изображение
- **За 23 фото:** ~$3.45 (~380 ₽ при курсе 110₽/$)

### Целевая аудитория — Дейтинг
- **Давинчик:** 15 000 000+ пользователей
- **Mamba, Badoo, Tinder:** 30M+ дейтинг-аудитория РФ
- Идеальный product-market fit — фото для анкет

### Финансовый прогноз
- **Цель:** 5 000 000 ₽ прибыли за 3 месяца
- **Конверсия:** 0.2% от дейтинг-аудитории = 35,000 платежей
- **Средний чек:** ~900 ₽
- **Маржа с партнёром:** 14-16%

---

*Last Updated: 2026-01-27 | v1.1*
