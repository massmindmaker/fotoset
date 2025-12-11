"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#0a0a0a",
            color: "#fafafa",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "4rem",
                marginBottom: "1rem",
              }}
            >
              :(
            </div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1rem",
              }}
            >
              Что-то пошло не так
            </h1>
            <p
              style={{
                color: "#a1a1aa",
                marginBottom: "2rem",
                lineHeight: "1.6",
              }}
            >
              Произошла непредвиденная ошибка. Мы уже знаем о проблеме и работаем
              над её устранением.
            </p>
            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: "1.5rem",
                  fontFamily: "monospace",
                }}
              >
                ID ошибки: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: "#ec4899",
                color: "white",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                fontSize: "1rem",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#db2777")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#ec4899")
              }
            >
              Попробовать снова
            </button>
            <div style={{ marginTop: "1.5rem" }}>
              <a
                href="/"
                style={{
                  color: "#71717a",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#71717a")}
              >
                Вернуться на главную
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
