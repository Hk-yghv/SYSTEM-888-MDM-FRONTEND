import React, { Suspense, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import Loading from "../utils/Loading";
import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import AppRoutes from "./AppRoutes";
import { installTableInteractions } from "../utils/tableInteractions";

const App = () => {
  useEffect(() => installTableInteractions(), []);

  useEffect(() => {
    const copyVisibleValue = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('button, a, input, textarea, select, [data-copy-cell]')) return;
      const cell = event.target.closest('td');
      const dialogValue = !cell && event.target.closest('[role="dialog"], .fixed.inset-0')
        ? event.target.closest('p, span, pre, dd')
        : null;
      const copyTarget = cell || dialogValue;
      const value = copyTarget?.innerText?.trim();
      if (!copyTarget || !value || value === '-') return;
      if (!navigator.clipboard?.writeText) {
        console.error('Clipboard API is unavailable; displayed value was not copied.');
        return;
      }
      navigator.clipboard.writeText(value).then(() => {
        copyTarget.classList.add('bg-emerald-100');
        window.setTimeout(() => copyTarget.classList.remove('bg-emerald-100'), 800);
      }).catch((error) => {
        console.error('Copy displayed value error:', error);
      });
    };
    const markTableCellCopyable = (event) => {
      if (!(event.target instanceof Element)) return;
      const cell = event.target.closest('td');
      if (!cell || cell.querySelector('button, a, input, textarea, select')) return;
      cell.classList.add('cursor-copy');
      if (!cell.title) cell.title = 'Click to copy';
    };
    document.addEventListener('click', copyVisibleValue);
    document.addEventListener('mouseover', markTableCellCopyable);
    return () => {
      document.removeEventListener('click', copyVisibleValue);
      document.removeEventListener('mouseover', markTableCellCopyable);
    };
  }, []);

  return (
    <Suspense fallback={<Loading />}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </Suspense>
  );
};

export default App;
