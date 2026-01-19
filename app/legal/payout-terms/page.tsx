/**
 * /legal/payout-terms
 *
 * Условия выплат реферального вознаграждения PinGlass
 * Выплаты через СБП (Jump.Finance)
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Условия выплат | PinGlass',
  description: 'Условия вывода реферального вознаграждения. СБП, комиссии, сроки обработки.',
}

export default function PayoutTermsPage() {
  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Условия выплат реферального вознаграждения
        </h1>

        <p className="text-muted-foreground mb-8">
          Редакция от 19 января 2026 года
        </p>

        <section className="space-y-6 text-foreground/90">
          <div>
            <h2 className="text-xl font-semibold mb-3">1. Способы вывода средств</h2>
            <p className="mb-2">
              1.1. Основной способ вывода — <strong>Система Быстрых Платежей (СБП)</strong>.
            </p>
            <p className="mb-2">
              1.2. Выплаты производятся на номер телефона, привязанный к банковскому счёту
              в любом банке, поддерживающем СБП.
            </p>
            <p>
              1.3. Альтернативные способы вывода (криптовалюта TON) могут быть доступны
              по отдельному запросу.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">2. Минимальная сумма</h2>
            <p className="mb-2">
              2.1. Минимальная сумма вывода: <strong>5 000 ₽</strong> (пять тысяч рублей).
            </p>
            <p className="mb-2">
              2.2. Максимальная сумма одной выплаты: <strong>600 000 ₽</strong>.
            </p>
            <p>
              2.3. Для вывода сумм свыше 600 000 ₽ необходимо создать несколько заявок.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">3. Комиссии</h2>

            <div className="bg-muted rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">Для самозанятых (НПД)</h3>
              <p className="text-2xl font-bold text-primary mb-1">~3%</p>
              <p className="text-sm text-muted-foreground">
                При подтверждённом статусе самозанятого через ФНС
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">Для остальных участников</h3>
              <p className="text-2xl font-bold text-primary mb-1">~6%</p>
              <p className="text-sm text-muted-foreground">
                Включает НДФЛ и комиссию платёжной системы
              </p>
            </div>

            <p className="mb-2">
              3.3. Точная сумма комиссии рассчитывается и отображается перед созданием
              заявки на вывод.
            </p>
            <p>
              3.4. Комиссия удерживается из суммы вывода. Например: при выводе 10 000 ₽
              с комиссией 3% на счёт поступит 9 700 ₽.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">4. Статус самозанятого</h2>
            <p className="mb-2">
              4.1. Для получения пониженной комиссии необходимо:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Быть зарегистрированным в качестве плательщика НПД (самозанятый)</li>
              <li>Подтвердить статус в личном кабинете через проверку ИНН</li>
            </ul>

            <p className="mb-2">
              4.2. <strong>Как стать самозанятым:</strong>
            </p>
            <ol className="list-decimal pl-6 mb-4">
              <li>Скачайте приложение «Мой налог» (ФНС России)</li>
              <li>Зарегистрируйтесь через Госуслуги или по паспорту</li>
              <li>Укажите вид деятельности: «Оказание информационных услуг»</li>
              <li>Подтвердите статус в личном кабинете PinGlass</li>
            </ol>

            <p className="mb-2">
              4.3. Преимущества статуса самозанятого:
            </p>
            <ul className="list-disc pl-6">
              <li>Пониженная комиссия при выводе (3% вместо 6%)</li>
              <li>Автоматическое формирование чеков</li>
              <li>Легальный налоговый учёт (налог 4-6% от дохода)</li>
              <li>Годовой лимит дохода: 2 400 000 ₽</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">5. Сроки обработки</h2>
            <p className="mb-2">
              5.1. Стандартный срок обработки заявки: <strong>до 3 рабочих дней</strong>.
            </p>
            <p className="mb-2">
              5.2. Для партнёров: <strong>до 1 рабочего дня</strong>.
            </p>
            <p className="mb-2">
              5.3. После одобрения заявки средства поступают на счёт в течение нескольких минут
              (зависит от банка получателя).
            </p>
            <p>
              5.4. Статус заявки отслеживается в личном кабинете и через Telegram-уведомления.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">6. Статусы заявки</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded text-sm font-medium">
                  Ожидает
                </span>
                <span>Заявка создана, ожидает обработки</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-600 rounded text-sm font-medium">
                  Обрабатывается
                </span>
                <span>Заявка одобрена, выплата в процессе</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-500/20 text-green-600 rounded text-sm font-medium">
                  Выполнено
                </span>
                <span>Средства отправлены на счёт</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-red-500/20 text-red-600 rounded text-sm font-medium">
                  Отклонено
                </span>
                <span>Заявка отклонена (указывается причина)</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">7. Причины отклонения</h2>
            <p className="mb-2">
              7.1. Заявка может быть отклонена по следующим причинам:
            </p>
            <ul className="list-disc pl-6 mb-2">
              <li>Недостаточно средств на балансе</li>
              <li>Некорректный номер телефона</li>
              <li>Телефон не привязан к банковскому счёту в СБП</li>
              <li>Подозрение на мошеннические действия</li>
              <li>Нарушение условий реферальной программы</li>
            </ul>
            <p>
              7.2. При отклонении заявки средства остаются на балансе и могут быть
              выведены после устранения причины отказа.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">8. Чеки и документы</h2>
            <p className="mb-2">
              8.1. Для самозанятых чеки формируются автоматически через систему «Мой налог».
            </p>
            <p className="mb-2">
              8.2. Ссылка на чек отправляется после успешного зачисления средств.
            </p>
            <p>
              8.3. Чеки можно скачать в личном кабинете в разделе «История выплат».
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">9. Лимиты</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Параметр</th>
                    <th className="text-left py-2 px-3">Значение</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3">Минимальный вывод</td>
                    <td className="py-2 px-3">5 000 ₽</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3">Максимальный вывод (разово)</td>
                    <td className="py-2 px-3">600 000 ₽</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 px-3">Заявок в день</td>
                    <td className="py-2 px-3">Без ограничений</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Годовой лимит (самозанятые)</td>
                    <td className="py-2 px-3">2 400 000 ₽</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">10. Поддержка</h2>
            <p className="mb-2">
              По вопросам выплат обращайтесь:
            </p>
            <ul className="list-disc pl-6">
              <li>Telegram: <a href="https://t.me/pinglass_support" className="text-primary underline">@pinglass_support</a></li>
              <li>В личном кабинете через форму обратной связи</li>
            </ul>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
          <p>© 2026 PinGlass. Все права защищены.</p>
        </div>
      </div>
    </main>
  )
}
