import React, { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import Loading from "../utils/Loading";
import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import AppRoutes from "./AppRoutes";

const App = () => {
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
