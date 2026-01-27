import { Suspense } from 'react'

export const metadata = {
  title: 'Вход - PinGlass',
  description: 'Вход в панель администратора или партнёра',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}
